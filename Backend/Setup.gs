/**
 * Setup.gs — Configuração inicial
 * --------------------------------
 * Antes de executar, defina a propriedade SENHA_INICIAL:
 *   1. No Apps Script, vá em Configurações do projeto > Propriedades do script
 *   2. Adicione a chave "SENHA_INICIAL" com a senha desejada (mín. 6 caracteres)
 *   3. Execute configurarSenha()
 *   4. Remova a propriedade SENHA_INICIAL após configurar
 */

function configurarSenha() {
  var senha = PropertiesService.getScriptProperties().getProperty("SENHA_INICIAL");
  if (!senha || senha.length < 6) {
    throw new Error("Defina a propriedade de script 'SENHA_INICIAL' com pelo menos 6 caracteres antes de executar.");
  }
  Auth_SetupPassword_(senha);
  Logger.log("Senha configurada com sucesso. Remova a propriedade SENHA_INICIAL agora.");
}
