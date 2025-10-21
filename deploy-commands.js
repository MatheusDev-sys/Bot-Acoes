// Este arquivo serve para registrar os "Slash Commands" (comandos com /)
// Você só precisa rodar este arquivo UMA VEZ, ou quando alterar um comando.
// Comando para rodar: node deploy-commands.js

require('dotenv').config();
const { REST, Routes, SlashCommandBuilder } = require('discord.js');

// Pega as credenciais dos arquivos de configuração
const token = process.env.DISCORD_TOKEN;
const clientId = process.env.CLIENT_ID;
const guildId = process.env.GUILD_ID; // ID do seu servidor (guilda)

// Verifica se todas as variáveis necessárias estão presentes
if (!token || !clientId || !guildId) {
    console.error('Por favor, defina DISCORD_TOKEN, CLIENT_ID, e GUILD_ID no seu arquivo .env');
    process.exit(1); // Encerra o script se algo estiver faltando
}

// Cria a definição do comando /criar_acao
const commands = [
    new SlashCommandBuilder()
        .setName('criar_acao')
        .setDescription('Cria um novo agendamento de ação com lista de presença.'),
]
    .map(command => command.toJSON());

// Cria uma instância do REST para se comunicar com a API do Discord
const rest = new REST({ version: '10' }).setToken(token);

// Função assíncrona para registrar os comandos
(async () => {
    try {
        console.log('Iniciando o registro de (/) comandos...');

        // O método 'put' registra ou atualiza todos os comandos no servidor especificado
        await rest.put(
            Routes.applicationGuildCommands(clientId, guildId),
            { body: commands },
        );

        console.log('(/) comandos registrados com sucesso!');
    } catch (error) {
        console.error('Ocorreu um erro ao registrar os comandos:', error);
    }
})();
