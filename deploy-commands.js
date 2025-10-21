// Este script registra os slash commands globalmente.
// Rode apenas uma vez quando criar ou alterar um comando: node deploy-commands.js

require('dotenv').config();
const { REST, Routes, SlashCommandBuilder } = require('discord.js');

const clientId = process.env.CLIENT_ID;
const token = process.env.DISCORD_TOKEN;

// Definição do comando /criar_acao
const commands = [
    new SlashCommandBuilder()
        .setName('criar_acao')
        .setDescription('Cria uma nova ação com lista de presença.')
].map(command => command.toJSON());

// Instância do REST para se comunicar com a API do Discord
const rest = new REST({ version: '10' }).setToken(token);

// Função para registrar os comandos
(async () => {
    try {
        console.log('Iniciando o registro de (/) comandos globais...');

        // O método 'put' sincroniza os comandos com a API.
        // Usamos Routes.applicationCommands para registro global.
        await rest.put(
            Routes.applicationCommands(clientId),
            { body: commands },
        );

        console.log('✅ Comandos globais (/) registrados com sucesso!');
    } catch (error) {
        console.error('Ocorreu um erro ao registrar os comandos:', error);
    }
})();

