// Este é o arquivo principal do seu bot.
// É ele que deve ficar rodando para o bot funcionar.
// Comando para rodar: node index.js

require('dotenv').config();
const express = require('express'); // Adicionado para o servidor web
const {
    Client,
    GatewayIntentBits,
    Events,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ActionRowBuilder,
    EmbedBuilder,
    ButtonBuilder,
    ButtonStyle,
    PermissionFlagsBits,
    MessageFlags
} = require('discord.js');

// Pega o token do arquivo .env
const token = process.env.DISCORD_TOKEN;

// Cria uma nova instância do cliente (o bot)
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

// "Ouvinte" que dispara quando o bot está pronto
client.on(Events.ClientReady, () => {
    console.log(`✅ Bot está online e logado como ${client.user.tag}!`);
});

// "Ouvinte" principal que reage a todas as interações (comandos, botões, modais)
client.on(Events.InteractionCreate, async interaction => {

    // --- LÓGICA PARA O COMANDO /criar_acao ---
    if (interaction.isChatInputCommand() && interaction.commandName === 'criar_acao') {
        // --- VERIFICAÇÃO DE CARGO ---
        const requiredRoleName = "Admin"; // <<-- MUDE AQUI PARA O NOME DO CARGO
        
        if (!interaction.member.roles.cache.some(role => role.name === requiredRoleName)) {
            return interaction.reply({
                content: `Você não tem permissão para criar uma ação. Apenas membros com o cargo "${requiredRoleName}" podem usar este comando.`,
                flags: [MessageFlags.Ephemeral]
            });
        }
        // --- FIM DA VERIFICAÇÃO ---

        const modal = new ModalBuilder()
            .setCustomId('modal_criar_acao')
            .setTitle('Criar Nova Ação');

        const nomeAcaoInput = new TextInputBuilder()
            .setCustomId('nomeAcaoInput')
            .setLabel("Qual o nome da ação?")
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

        const faccaoInput = new TextInputBuilder()
            .setCustomId('faccaoInput')
            .setLabel("Qual a facção/organização?")
            .setStyle(TextInputStyle.Short)
            .setRequired(true);
        
        const dataInput = new TextInputBuilder()
            .setCustomId('dataInput')
            .setLabel("Data da Ação")
            .setPlaceholder('Ex: 25/12/2025')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

        const horarioInput = new TextInputBuilder()
            .setCustomId('horarioInput')
            .setLabel("Horário da Ação")
            .setPlaceholder('Ex: 21:00')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

        const vagasInput = new TextInputBuilder()
            .setCustomId('vagasInput')
            .setLabel("Quantidade de vagas?")
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

        modal.addComponents(
            new ActionRowBuilder().addComponents(nomeAcaoInput),
            new ActionRowBuilder().addComponents(faccaoInput),
            new ActionRowBuilder().addComponents(dataInput),
            new ActionRowBuilder().addComponents(horarioInput),
            new ActionRowBuilder().addComponents(vagasInput)
        );

        await interaction.showModal(modal);
    }

    // --- LÓGICA PARA QUANDO O MODAL É ENVIADO ---
    if (interaction.isModalSubmit() && interaction.customId.startsWith('modal_')) {
        const channel = await client.channels.fetch(interaction.channelId);
        if (!channel) {
            console.error(`Canal com ID ${interaction.channelId} não encontrado.`);
            return interaction.reply({ content: 'Ocorreu um erro ao encontrar o canal para enviar a mensagem.', flags: [MessageFlags.Ephemeral] });
        }

        if (interaction.customId === 'modal_criar_acao') {
            await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });

            const nomeAcao = interaction.fields.getTextInputValue('nomeAcaoInput');
            const faccao = interaction.fields.getTextInputValue('faccaoInput');
            const data = interaction.fields.getTextInputValue('dataInput');
            const horario = interaction.fields.getTextInputValue('horarioInput');
            const vagas = parseInt(interaction.fields.getTextInputValue('vagasInput'), 10);
            
            const dataHorario = `${data} às ${horario}`;

            if (isNaN(vagas) || vagas <= 0) {
                return interaction.editReply({ content: 'A quantidade de vagas deve ser um número maior que zero.', flags: [MessageFlags.Ephemeral] });
            }

            const embedAcao = new EmbedBuilder()
                .setColor(0x0099FF)
                .setTitle(`[${faccao}] - ${nomeAcao}`)
                .setDescription(`**Data/Horário:** ${dataHorario}`)
                .addFields({ name: `Participantes (0/${vagas}):`, value: '*Ninguém confirmado ainda.*' })
                .setFooter({ text: `Ação criada por: ${interaction.user.tag}` })
                .setTimestamp();

            const botoes = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder().setCustomId('confirmar_presenca').setLabel('Confirmar Presença').setStyle(ButtonStyle.Success).setEmoji('✔️'),
                    new ButtonBuilder().setCustomId('cancelar_presenca').setLabel('Cancelar Presença').setStyle(ButtonStyle.Danger).setEmoji('✖️'),
                    new ButtonBuilder().setCustomId('editar_acao').setLabel('Editar').setStyle(ButtonStyle.Secondary).setEmoji('⚙️'),
                    new ButtonBuilder().setCustomId('encerrar_acao').setLabel('Encerrar').setStyle(ButtonStyle.Danger).setEmoji('🛑')
                );

            const acaoMessage = await channel.send({ embeds: [embedAcao], components: [botoes] });
            await interaction.editReply({ content: 'Ação criada com sucesso!', flags: [MessageFlags.Ephemeral] });

            // --- AGENDAMENTO DE ENCERRAMENTO AUTOMÁTICO ---
            // Nota: este agendamento não é persistente. Se o bot for reiniciado, o agendamento é perdido.
            try {
                const dataRegex = /^\d{2}\/\d{2}\/\d{4}$/;
                const horarioRegex = /^\d{2}:\d{2}$/;

                if (dataRegex.test(data) && horarioRegex.test(horario)) {
                    const [day, month, year] = data.split('/');
                    const [hour, minute] = horario.split(':');
                    
                    const eventDate = new Date(year, month - 1, day, hour, minute);
                    const now = new Date();
                    const delay = eventDate.getTime() - now.getTime();

                    const MAX_TIMEOUT_DELAY = 2147483647;

                    if (delay > 0 && delay < MAX_TIMEOUT_DELAY) {
                        setTimeout(async () => {
                            try {
                                const fetchedChannel = await client.channels.fetch(channel.id);
                                const messageToEnd = await fetchedChannel.messages.fetch(acaoMessage.id);
                                if (messageToEnd) {
                                    await encerrarAcao(messageToEnd);
                                    console.log(`Ação (ID: ${acaoMessage.id}) encerrada automaticamente.`);
                                }
                            } catch (err) {
                                console.error(`Falha ao encerrar automaticamente a ação (ID: ${acaoMessage.id}). Erro: ${err.message}`);
                            }
                        }, delay);
                    }
                }
            } catch (error) {
                console.error('Erro ao agendar o encerramento automático da ação:', error);
            }
        }
        
        if (interaction.customId.startsWith('modal_editar_acao')) {
            // ... (código de edição inalterado)
        }
    }

    // --- LÓGICA PARA QUANDO UM BOTÃO É CLICADO ---
    if (interaction.isButton()) {
        const { customId } = interaction;
        const message = interaction.message;
        const originalEmbed = message.embeds[0];
        const userTag = interaction.user.tag;

        let [current, max] = originalEmbed.fields[0].name.match(/(\d+)/g).map(Number);
        let participantsList = originalEmbed.fields[0].value;
        const participantsArray = participantsList.includes('\n') ? participantsList.split('\n') : (participantsList.startsWith('- ') ? [participantsList] : []);

        if (customId === 'confirmar_presenca') {
            if (participantsList.includes(userTag)) {
                return interaction.reply({ content: 'Você já está na lista!', flags: [MessageFlags.Ephemeral] });
            }
            if (current >= max) {
                return interaction.reply({ content: 'As vagas para esta ação estão esgotadas!', flags: [MessageFlags.Ephemeral] });
            }

            const newParticipantsList = participantsList === '*Ninguém confirmado ainda.*' ? `- ${userTag}` : `${participantsList}\n- ${userTag}`;
            const updatedEmbed = EmbedBuilder.from(originalEmbed).setFields({ name: `Participantes (${current + 1}/${max}):`, value: newParticipantsList });

            await message.edit({ embeds: [updatedEmbed] });
            await interaction.reply({ content: 'Presença confirmada!', flags: [MessageFlags.Ephemeral] });
        }

        if (customId === 'cancelar_presenca') {
            if (!participantsList.includes(userTag)) {
                return interaction.reply({ content: 'Você não estava na lista para cancelar.', flags: [MessageFlags.Ephemeral] });
            }

            const newArray = participantsArray.filter(user => !user.includes(userTag));
            const newParticipantsList = newArray.length > 0 ? newArray.join('\n') : '*Ninguém confirmado ainda.*';
            const updatedEmbed = EmbedBuilder.from(originalEmbed).setFields({ name: `Participantes (${current - 1}/${max}):`, value: newParticipantsList });

            await message.edit({ embeds: [updatedEmbed] });
            await interaction.reply({ content: 'Presença cancelada.', flags: [MessageFlags.Ephemeral] });
        }
        
        if (customId === 'editar_acao') {
            if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
                return interaction.reply({ content: 'Você não tem permissão para editar esta ação.', flags: [MessageFlags.Ephemeral] });
            }
            
            const faccao = originalEmbed.title.match(/\[(.*?)\]/)[1];
            const nomeAcao = originalEmbed.title.split('] - ')[1];
            
            const fullDateTime = originalEmbed.description.split(':** ')[1];
            const [dataValue, horarioValue] = fullDateTime.includes(' às ') ? fullDateTime.split(' às ') : [fullDateTime, ''];

            const modal = new ModalBuilder()
                .setCustomId(`modal_editar_acao_${message.id}`)
                .setTitle('Editar Ação Existente');

            modal.addComponents(
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('nomeAcaoInput').setLabel("Nome da ação").setStyle(TextInputStyle.Short).setValue(nomeAcao)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('faccaoInput').setLabel("Facção/Organização").setStyle(TextInputStyle.Short).setValue(faccao)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('dataInput').setLabel("Data da Ação").setPlaceholder('Ex: 25/12/2025').setStyle(TextInputStyle.Short).setValue(dataValue)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('horarioInput').setLabel("Horário da Ação").setPlaceholder('Ex: 21:00').setStyle(TextInputStyle.Short).setValue(horarioValue)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('vagasInput').setLabel("Quantidade de vagas").setStyle(TextInputStyle.Short).setValue(max.toString()))
            );
            
            await interaction.showModal(modal);
        }

        if (customId === 'encerrar_acao') {
            if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
                return interaction.reply({ content: 'Você não tem permissão para encerrar esta ação.', flags: [MessageFlags.Ephemeral] });
            }
            await encerrarAcao(message);
            await interaction.reply({ content: 'Ação encerrada com sucesso!', flags: [MessageFlags.Ephemeral] });
        }
    }
});

/**
 * Função auxiliar para encerrar uma ação, atualizando o embed e desativando os botões.
 * @param {import('discord.js').Message} message A mensagem da ação a ser encerrada.
 */
async function encerrarAcao(message) {
    if (!message || !message.embeds || message.embeds.length === 0) return;

    const originalEmbed = message.embeds[0];

    // Verifica se já está encerrada para evitar edições desnecessárias.
    if (originalEmbed.title.includes('[ENCERRADA]')) return;

    const updatedEmbed = EmbedBuilder.from(originalEmbed)
        .setTitle(`[ENCERRADA] ${originalEmbed.title.replace(/\[.*?\]\s*-\s*/, '')}`)
        .setColor(0x808080); // Cor cinza

    // Desativa todos os botões na mensagem.
    const disabledComponents = message.components.map(row => {
        const newRow = ActionRowBuilder.from(row);
        newRow.components.forEach(component => component.setDisabled(true));
        return newRow;
    });

    await message.edit({ embeds: [updatedEmbed], components: disabledComponents });
}

// --- SERVIDOR WEB PARA MANTER O BOT ATIVO (RENDER/UPTIMEROBOT) ---
const app = express();
const port = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.send('O bot está vivo e operante!');
});

app.listen(port, () => {
  console.log(`🌐 Servidor web de keep-alive rodando na porta ${port}`);
});
// --- FIM DO SERVIDOR WEB ---


// Faz o login do bot usando o token
client.login(token);

