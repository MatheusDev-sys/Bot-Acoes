// Este script serve para remover comandos antigos registrados APENAS no seu servidor.
// Rode-o apenas uma vez para corrigir o problema de comandos duplicados.
// Comando para rodar: node clear-commands.js

require('dotenv').config();
const { REST } = require('@discordjs/rest');
const { Routes } = require('discord.js');

const token = process.env.DISCORD_TOKEN;
const clientId = process.env.CLIENT_ID;
const guildId = process.env.GUILD_ID; // Necessário para limpar os comandos do servidor específico

if (!token || !clientId || !guildId) {
    console.error('ERRO: Certifique-se de que DISCORD_TOKEN, CLIENT_ID, e GUILD_ID estão no seu arquivo .env para poder limpar os comandos.');
    process.exit(1);
}

const rest = new REST({ version: '10' }).setToken(token);

// Este comando envia uma lista vazia para os comandos do seu servidor, efetivamente limpando todos eles.
console.log(`Iniciando a limpeza de comandos para o servidor (guild) ID: ${guildId}`);

rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: [] })
	.then(() => console.log('✅ Comandos específicos do servidor foram removidos com sucesso.'))
	.catch(console.error);
