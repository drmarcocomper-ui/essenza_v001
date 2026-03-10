// export.js — Utilitários de exportação (Excel e PDF)
// Requer: SheetJS (xlsx) e jsPDF + jsPDF-AutoTable via CDN
// Requer: utils.js (window.EssenzaUtils)
// Usado por: lancamentos.js, resumo.js

(() => {
  "use strict";

  const { formatDateBR, formatMoneyBR: formatMoneyUtil } = window.EssenzaUtils;

  // formatMoneyBR para exportação: sem prefixo R$, apenas número formatado
  function formatMoneyBR(v) {
    const num = typeof v === "number" ? v : (parseFloat(v) || 0);
    return num.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function getTimestamp() {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const d = String(now.getDate()).padStart(2, "0");
    const h = String(now.getHours()).padStart(2, "0");
    const min = String(now.getMinutes()).padStart(2, "0");
    return `${y}${m}${d}_${h}${min}`;
  }

  // ============================
  // Exportar para Excel
  // ============================
  function exportToExcel(data, columns, filename) {
    if (typeof XLSX === "undefined") {
      alert("Biblioteca XLSX não carregada. Recarregue a página.");
      return;
    }

    // Preparar dados
    const headers = columns.map(c => c.label);
    const rows = data.map(row => {
      return columns.map(c => {
        let val = row[c.key] ?? "";
        if (c.type === "date") val = formatDateBR(val);
        if (c.type === "money") val = parseFloat(val) || 0;
        return val;
      });
    });

    // Criar workbook
    const wsData = [headers, ...rows];
    const ws = XLSX.utils.aoa_to_sheet(wsData);

    // Ajustar largura das colunas
    const colWidths = columns.map(c => ({ wch: c.width || 15 }));
    ws["!cols"] = colWidths;

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Dados");

    // Download
    const finalName = `${filename}_${getTimestamp()}.xlsx`;
    XLSX.writeFile(wb, finalName);
  }

  // ============================
  // Exportar para PDF
  // ============================
  function exportToPDF(data, columns, filename, title) {
    if (typeof jspdf === "undefined" || typeof jspdf.jsPDF === "undefined") {
      alert("Biblioteca jsPDF não carregada. Recarregue a página.");
      return;
    }

    const { jsPDF } = jspdf;
    const doc = new jsPDF({
      orientation: columns.length > 6 ? "landscape" : "portrait",
      unit: "mm",
      format: "a4"
    });

    const pageWidth = doc.internal.pageSize.getWidth();

    // Titulo
    doc.setFontSize(16);
    doc.setTextColor(50);
    doc.text(title || filename, 14, 15);

    // Data de geracao
    doc.setFontSize(9);
    doc.setTextColor(100);
    const now = new Date();
    doc.text(`Gerado em: ${now.toLocaleDateString("pt-BR")} ${now.toLocaleTimeString("pt-BR")}`, 14, 22);

    // Summary info: record count + primary money total
    let summaryText = `Registros: ${data.length}`;
    const firstMoneyCol = columns.find(function(c) { return c.type === "money"; });
    if (firstMoneyCol) {
      let moneyTotal = 0;
      data.forEach(function(row) { moneyTotal += (parseFloat(row[firstMoneyCol.key]) || 0); });
      summaryText += "  |  " + firstMoneyCol.label + ": " + formatMoneyBR(moneyTotal);
    }
    doc.setFontSize(8);
    doc.setTextColor(120);
    doc.text(summaryText, 14, 27);

    // Separator line
    doc.setDrawColor(180);
    doc.setLineWidth(0.3);
    doc.line(14, 29, pageWidth - 14, 29);

    // Preparar dados para tabela
    const headers = columns.map(c => c.label);
    const rows = data.map(row => {
      return columns.map(c => {
        let val = row[c.key] ?? "";
        if (c.type === "date") val = formatDateBR(val);
        if (c.type === "money") val = formatMoneyBR(val);
        return String(val);
      });
    });

    // Build totals footer row
    const footerRow = columns.map(function(col, idx) {
      if (col.type === "money") {
        let sum = 0;
        data.forEach(function(row) { sum += (parseFloat(row[col.key]) || 0); });
        return formatMoneyBR(sum);
      }
      return idx === 0 ? "TOTAL" : "";
    });

    // Track page numbers for post-render fix
    var totalPages = 0;

    // Criar tabela
    doc.autoTable({
      head: [headers],
      body: rows,
      foot: [footerRow],
      startY: 32,
      styles: {
        fontSize: 8,
        cellPadding: 3
      },
      headStyles: {
        fillColor: [139, 92, 165],
        textColor: 255,
        fontStyle: "bold"
      },
      footStyles: {
        fillColor: [230, 220, 240],
        textColor: [50, 50, 50],
        fontStyle: "bold"
      },
      alternateRowStyles: {
        fillColor: [240, 240, 240]
      },
      columnStyles: columns.reduce((acc, col, idx) => {
        if (col.type === "money") {
          acc[idx] = { halign: "right" };
        }
        return acc;
      }, {}),
      didDrawPage: function(hookData) {
        totalPages = doc.internal.getNumberOfPages();
        var pageH = doc.internal.pageSize.getHeight();
        doc.setFontSize(7);
        doc.setTextColor(150);
        doc.text("Pagina " + hookData.pageNumber, pageWidth - 14, pageH - 8, { align: "right" });
      }
    });

    // Fix page numbers with total count
    for (var p = 1; p <= totalPages; p++) {
      doc.setPage(p);
      var pageH = doc.internal.pageSize.getHeight();
      // Overwrite with "Pagina X de Y"
      doc.setFillColor(255, 255, 255);
      doc.rect(pageWidth - 40, pageH - 11, 30, 6, "F");
      doc.setFontSize(7);
      doc.setTextColor(150);
      doc.text("Pagina " + p + " de " + totalPages, pageWidth - 14, pageH - 8, { align: "right" });
    }

    // Download
    const finalName = `${filename}_${getTimestamp()}.pdf`;
    doc.save(finalName);
  }

  // ============================
  // Configurações de colunas predefinidas
  // ============================
  const COLUMNS_LANCAMENTOS = [
    { key: "Data_Competencia", label: "Data Comp.", type: "date", width: 12 },
    { key: "Data_Caixa", label: "Data Caixa", type: "date", width: 12 },
    { key: "Tipo", label: "Tipo", width: 10 },
    { key: "Categoria", label: "Categoria", width: 15 },
    { key: "Descricao", label: "Descricao", width: 20 },
    { key: "ID_Cliente", label: "Cliente/Forn.", width: 18 },
    { key: "Forma_Pagamento", label: "Forma Pgto", width: 12 },
    { key: "Valor", label: "Valor", type: "money", width: 12 },
    { key: "Status", label: "Status", width: 10 }
  ];

  const COLUMNS_RESUMO = [
    { key: "Mês", label: "Mes", width: 10 },
    { key: "Entradas Pagas", label: "Entradas Pagas", type: "money", width: 15 },
    { key: "Entradas Pendentes", label: "Entr. Pendentes", type: "money", width: 15 },
    { key: "Total Entradas", label: "Total Entradas", type: "money", width: 15 },
    { key: "Saidas", label: "Saidas", type: "money", width: 12 },
    { key: "Resultado (Caixa)", label: "Resultado", type: "money", width: 12 }
  ];

  // ============================
  // Exportar Backup Completo (múltiplas abas)
  // ============================
  function exportBackupExcel(sheetsData, filename) {
    if (typeof XLSX === "undefined") {
      alert("Biblioteca XLSX não carregada. Recarregue a página.");
      return;
    }

    const wb = XLSX.utils.book_new();
    const sheetOrder = ["Cadastro", "Lancamentos", "Categoria", "Fornecedores"];

    sheetOrder.forEach(sheetName => {
      const sheetInfo = sheetsData[sheetName];
      if (!sheetInfo || !sheetInfo.exists) {
        // Criar aba vazia com mensagem
        const ws = XLSX.utils.aoa_to_sheet([["Aba não encontrada ou vazia"]]);
        XLSX.utils.book_append_sheet(wb, ws, sheetName);
        return;
      }

      const headers = sheetInfo.headers || [];
      const data = sheetInfo.data || [];

      if (headers.length === 0) {
        const ws = XLSX.utils.aoa_to_sheet([["Sem dados"]]);
        XLSX.utils.book_append_sheet(wb, ws, sheetName);
        return;
      }

      // Converter objetos para array de arrays
      const rows = data.map(row => {
        return headers.map(h => {
          let val = row[h] ?? "";
          // Formatar datas
          if (h.includes("Data") && /^\d{4}-\d{2}-\d{2}$/.test(val)) {
            val = formatDateBR(val);
          }
          return val;
        });
      });

      const wsData = [headers, ...rows];
      const ws = XLSX.utils.aoa_to_sheet(wsData);

      // Ajustar largura das colunas
      const colWidths = headers.map(h => {
        const len = Math.max(h.length, 15);
        return { wch: Math.min(len, 30) };
      });
      ws["!cols"] = colWidths;

      XLSX.utils.book_append_sheet(wb, ws, sheetName);
    });

    // Download
    const finalName = `${filename}_${getTimestamp()}.xlsx`;
    XLSX.writeFile(wb, finalName);
  }

  // ============================
  // API Pública
  // ============================
  window.EssenzaExport = {
    // Exportar lançamentos
    lancamentosExcel: function(data) {
      exportToExcel(data, COLUMNS_LANCAMENTOS, "lancamentos");
    },
    lancamentosPDF: function(data) {
      exportToPDF(data, COLUMNS_LANCAMENTOS, "lancamentos", "Relatorio de Lancamentos");
    },

    // Exportar resumo
    resumoExcel: function(data) {
      exportToExcel(data, COLUMNS_RESUMO, "resumo_mensal");
    },
    resumoPDF: function(data) {
      exportToPDF(data, COLUMNS_RESUMO, "resumo_mensal", "Resumo Mensal");
    },

    // Backup completo
    backupExcel: exportBackupExcel,

    // Genérico (para uso customizado)
    toExcel: exportToExcel,
    toPDF: exportToPDF
  };
})();
