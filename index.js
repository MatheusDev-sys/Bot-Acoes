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
const requiredRoleName = "Resp Ações"; // Cargo principal para permissões

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
    try {
        // --- LÓGICA PARA O COMANDO /criar_acao ---
        if (interaction.isChatInputCommand() && interaction.commandName === 'criar_acao') {
            // --- VERIFICAÇÃO DE CARGO ---
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
                .setLabel("Local/Nome da Ação")
                .setPlaceholder('Ex: Patrulha no Sul')
                .setStyle(TextInputStyle.Short)
                .setRequired(true);

            const faccaoInput = new TextInputBuilder()
                .setCustomId('faccaoInput')
                .setLabel("Facção/Organização")
                .setPlaceholder('Ex: Policia')
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

            // --- SUBMISSÃO DO MODAL DE CRIAÇÃO ---
            if (interaction.customId === 'modal_criar_acao') {
                await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });

                const nomeAcao = interaction.fields.getTextInputValue('nomeAcaoInput');
                const faccao = interaction.fields.getTextInputValue('faccaoInput');
                const data = interaction.fields.getTextInputValue('dataInput');
                const horario = interaction.fields.getTextInputValue('horarioInput');
                const vagas = parseInt(interaction.fields.getTextInputValue('vagasInput'), 10);
                
                if (isNaN(vagas) || vagas <= 0) {
                    return interaction.editReply({ content: 'A quantidade de vagas deve ser um número maior que zero.', flags: [MessageFlags.Ephemeral] });
                }

                const embedAcao = new EmbedBuilder()
                    .setColor(0x0099FF)
                    .setTitle(`:dart: Ação: ${nomeAcao} - ${faccao}`)
                    .setDescription(':loudspeaker: **Confirme sua Presença!**')
                    .addFields(
                        { name: ':date: Data', value: data, inline: true },
                        { name: ':alarm_clock: Horário', value: horario, inline: true },
                        { name: ':busts_in_silhouette: Vagas', value: `(0/${vagas})`, inline: true },
                        { name: '\u200B', value: '\u200B' }, // Linha em branco
                        { name: `:white_check_mark: Confirmados (0/${vagas}):`, value: '*Ninguém confirmado ainda.*' },
                        { name: `:pushpin: Reservas (0):`, value: '*Ninguém na reserva.*' }
                    )
                    .setFooter({ text: `Ação criada por: ${interaction.user.tag}\n⚠️ Oficiais que confirmarem e não comparecerem levarão advertência.` })
                    .setTimestamp();

                const botoes = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder().setCustomId('confirmar_presenca').setLabel('Confirmar').setStyle(ButtonStyle.Success).setEmoji('✔️'),
                        new ButtonBuilder().setCustomId('cancelar_presenca').setLabel('Cancelar').setStyle(ButtonStyle.Danger).setEmoji('✖️'),
                        new ButtonBuilder().setCustomId('reserva_presenca').setLabel('Reserva').setStyle(ButtonStyle.Primary).setEmoji('📌'),
                        new ButtonBuilder().setCustomId('editar_acao').setLabel('Editar').setStyle(ButtonStyle.Secondary).setEmoji('⚙️'),
                        new ButtonBuilder().setCustomId('encerrar_acao').setLabel('Encerrar').setStyle(ButtonStyle.Danger).setEmoji('🛑')
                    );

                const acaoMessage = await channel.send({ embeds: [embedAcao], components: [botoes] });
                await interaction.editReply({ content: 'Ação criada com sucesso!', flags: [MessageFlags.Ephemeral] });

                // --- AGENDAMENTO DE ENCERRAMENTO AUTOMÁTICO ---
                try {
                    // [CORREÇÃO AQUI] Regex agora aceita 1 ou 2 dígitos para dia e mês
                    const dataRegex = /^\d{1,2}\/\d{1,2}\/\d{4}$/;
                    const horarioRegex = /^\d{2}:\d{2}$/;

                    if (dataRegex.test(data) && horarioRegex.test(horario)) {
                        const [day, month, year] = data.split('/');
                        const [hour, minute] = horario.split(':');
                        
                        const fusoHorarioOffsetHoras = -3; // Ajuste para fuso horário (Ex: -3 para BRT)
                        
                        const now = new Date();
                        
                        // 1. Cria a data como se fosse UTC
                        const eventDateUTC = Date.UTC(year, month - 1, day, hour, minute);
                        // 2. Subtrai o fuso horário para "corrigir" para o UTC real
                        const correctEventTimeUTC = eventDateUTC - (fusoHorarioOffsetHoras * 60 * 60 * 1000);
                        
                        const delay = correctEventTimeUTC - now.getTime();
                        
                        console.log(`[Agendamento] Ação ID: ${acaoMessage.id}`);
                        console.log(`[Agendamento] Data/Hora Inserida (Assumindo BRT): ${data} ${horario}`);
                        console.log(`[Agendamento] Timestamp Evento Corrigido (UTC): ${new Date(correctEventTimeUTC).toISOString()}`);
                        console.log(`[Agendamento] Agora (Servidor): ${now.toISOString()}`);
                        console.log(`[Agendamento] Delay calculado (ms): ${delay}`);


                        const MAX_TIMEOUT_DELAY = 2147483647;

                        if (delay > 0 && delay < MAX_TIMEOUT_DELAY) {
                            console.log(`[Agendamento] SUCESSO: Ação ${acaoMessage.id} será encerrada em ${Math.round(delay / 1000 / 60)} minutos.`);
                            setTimeout(async () => {
                                try {
                                    const fetchedChannel = await client.channels.fetch(channel.id);
                                    const messageToEnd = await fetchedChannel.messages.fetch(acaoMessage.id);
                                    if (messageToEnd) {
                                        await encerrarAcao(messageToEnd);
                                        console.log(`[Agendamento] Ação (ID: ${acaoMessage.id}) encerrada automaticamente.`);
                                    }
                                } catch (err) {
                                    console.error(`[Agendamento] Falha ao encerrar automaticamente a ação (ID: ${acaoMessage.id}). Erro: ${err.message}`);
                                }
                            }, delay);
                        } else {
                             console.warn(`[Agendamento] FALHA: Delay para ação ${acaoMessage.id} está fora do limite (delay: ${delay}). Pode já ter passado ou ser muito longo.`);
                        }
                    } else {
                         console.warn(`[Agendamento] FALHA: Formato de data (${data}) ou hora (${horario}) inválido.`);
                    }
                } catch (error) {
                    console.error('[Agendamento] Erro crítico ao agendar o encerramento da ação:', error);
                }
            }
            
            // --- SUBMISSÃO DO MODAL DE EDIÇÃO ---
            if (interaction.customId.startsWith('modal_editar_acao_')) {
                await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });
                
                const messageId = interaction.customId.split('_').pop();
                const messageToEdit = await channel.messages.fetch(messageId);
                if (!messageToEdit) {
                    return interaction.editReply({ content: 'Não foi possível encontrar a mensagem da ação original.', flags: [MessageFlags.Ephemeral] });
                }
                
                const oldEmbed = messageToEdit.embeds[0];
                
                const nomeAcao = interaction.fields.getTextInputValue('nomeAcaoInput');
                const faccao = interaction.fields.getTextInputValue('faccaoInput');
                const data = interaction.fields.getTextInputValue('dataInput');
                const horario = interaction.fields.getTextInputValue('horarioInput');
                const vagas = parseInt(interaction.fields.getTextInputValue('vagasInput'), 10);
                
                if (isNaN(vagas) || vagas <= 0) {
                    return interaction.editReply({ content: 'A quantidade de vagas deve ser um número maior que zero.', flags: [MessageFlags.Ephemeral] });
                }

                let confirmadosField = oldEmbed.fields.find(f => f.name.startsWith(':white_check_mark:'));
                let reservasField = oldEmbed.fields.find(f => f.name.startsWith(':pushpin:'));
                
                const confirmadosCount = confirmadosField.value === '*Ninguém confirmado ainda.*' ? 0 : confirmadosField.value.split('\n').length;
                confirmadosField.name = `:white_check_mark: Confirmados (${confirmadosCount}/${vagas}):`;

                let vagasField = oldEmbed.fields.find(f => f.name === ':busts_in_silhouette: Vagas');
                vagasField.value = `(${confirmadosCount}/${vagas})`;


                const updatedEmbed = EmbedBuilder.from(oldEmbed)
                    .setTitle(`:dart: Ação: ${nomeAcao} - ${faccao}`)
                    .setFields(
                        { name: ':date: Data', value: data, inline: true },
                        { name: ':alarm_clock: Horário', value: horario, inline: true },
                        vagasField,
                        { name: '\u200B', value: '\u200B' },
                        confirmadosField,
                        reservasField
                    );
                
                await messageToEdit.edit({ embeds: [updatedEmbed] });
                await interaction.editReply({ content: 'Ação editada com sucesso!', flags: [MessageFlags.Ephemeral] });
            }
        }

        // --- LÓGICA PARA QUANDO UM BOTÃO É CLICADO ---
        if (interaction.isButton()) {
            const { customId } = interaction;
            const message = interaction.message;
            const originalEmbed = message.embeds[0];
            
            if (originalEmbed.title.includes('[ENCERRADA]')) {
                 return interaction.reply({ content: 'Esta ação já foi encerrada.', flags: [MessageFlags.Ephemeral] });
            }
            
            const hasPermission = () => {
                 if (interaction.member.permissions.has(PermissionFlagsBits.Administrator)) return true;
                 if (interaction.member.roles.cache.some(role => role.name === requiredRoleName)) return true;
                 return false;
            };
            
            if (customId === 'editar_acao') {
                if (!hasPermission()) {
                    return interaction.reply({ content: `Você não tem permissão para editar. Apenas Administradores ou cargos "${requiredRoleName}".`, flags: [MessageFlags.Ephemeral] });
                }
                
                const titleMatch = originalEmbed.title.match(/Ação: (.*) - (.*)/);
                if (!titleMatch) {
                     console.error("Regex do título falhou ao editar:", originalEmbed.title);
                     return interaction.reply({ content: 'Erro ao ler o título da ação para edição.', flags: [MessageFlags.Ephemeral] });
                }
                const nomeAcao = titleMatch[1];
                const faccao = titleMatch[2];
                
                const fields = originalEmbed.fields;
                const dataValue = fields.find(f => f.name === ':date: Data').value;
                const horarioValue = fields.find(f => f.name === ':alarm_clock: Horário').value;
                const confirmadosField = fields.find(f => f.name.startsWith(':white_check_mark:'));
                const [current, max] = confirmadosField.name.match(/(\d+)/g).map(Number);
                const vagasValue = max.toString();

                const modal = new ModalBuilder()
                    .setCustomId(`modal_editar_acao_${message.id}`)
                    .setTitle('Editar Ação Existente');

                modal.addComponents(
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('nomeAcaoInput').setLabel("Local/Nome da Ação").setStyle(TextInputStyle.Short).setValue(nomeAcao)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('faccaoInput').setLabel("Facção/Organização").setStyle(TextInputStyle.Short).setValue(faccao)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('dataInput').setLabel("Data da Ação").setPlaceholder('Ex: 25/12/2025').setStyle(TextInputStyle.Short).setValue(dataValue)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('horarioInput').setLabel("Horário da Ação").setPlaceholder('Ex: 21:00').setStyle(TextInputStyle.Short).setValue(horarioValue)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('vagasInput').setLabel("Quantidade de vagas").setStyle(TextInputStyle.Short).setValue(vagasValue))
                );
                
                await interaction.showModal(modal);
                return; 
            }

            if (customId === 'encerrar_acao') {
                 if (!hasPermission()) {
                    return interaction.reply({ content: `Você não tem permissão para encerrar. Apenas Administradores ou cargos "${requiredRoleName}".`, flags: [MessageFlags.Ephemeral] });
                }
                await encerrarAcao(message);
                await interaction.reply({ content: 'Ação encerrada com sucesso!', flags: [MessageFlags.Ephemeral] });
                return; 
            }

            await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });
            
            const userTag = interaction.user.tag; 
            const userMention = interaction.user.toString(); 

            const fields = originalEmbed.fields;
            
            let vagasField = fields.find(f => f.name === ':busts_in_silhouette: Vagas');
            let confirmadosField = fields.find(f => f.name.startsWith(':white_check_mark:'));
            let reservasField = fields.find(f => f.name.startsWith(':pushpin:'));

            const [current, max] = confirmadosField.name.match(/(\d+)/g).map(Number);
            
            let confirmadosList = confirmadosField.value;
            let reservasList = reservasField.value;
            
            const isUserInAnyList = (tag) => {
                return confirmadosList.includes(tag) || reservasList.includes(tag);
            };
            
            const removeUserFromLists = (tag) => {
                 let listChanged = false;
                 if (confirmadosList.includes(tag)) {
                     const lines = confirmadosList.split('\n');
                     const newLines = lines.filter(line => !line.includes(tag));
                     confirmadosList = newLines.length > 0 ? newLines.join('\n') : '*Ninguém confirmado ainda.*';
                     listChanged = true;
                 }
                 if (reservasList.includes(tag)) {
                     const lines = reservasList.split('\n');
                     const newLines = lines.filter(line => !line.includes(tag));
                     reservasList = newLines.length > 0 ? newLines.join('\n') : '*Ninguém na reserva.*';
                     listChanged = true;
                 }
                 return listChanged;
            };

            const userEntry = `${userMention} (${userTag})`; 
            let replyContent = ''; 

            if (customId === 'confirmar_presenca') {
                if (isUserInAnyList(userTag)) {
                     if(confirmadosList.includes(userTag)) {
                        return interaction.editReply({ content: 'Você já está na lista de confirmados!' });
                     }
                     removeUserFromLists(userTag);
                }
                
                if (current >= max) {
                    reservasList = reservasList === '*Ninguém na reserva.*' ? `- ${userEntry}` : `${reservasList}\n- ${userEntry}`;
                    replyContent = 'As vagas estão esgotadas! Você foi adicionado à lista de reserva.';
                } else {
                    confirmadosList = confirmadosList === '*Ninguém confirmado ainda.*' ? `- ${userEntry}` : `${confirmadosList}\n- ${userEntry}`;
                    replyContent = 'Presença confirmada!';
                }
            }

            if (customId === 'cancelar_presenca') {
                if (!isUserInAnyList(userTag)) {
                    return interaction.editReply({ content: 'Você não estava em nenhuma lista para cancelar.' });
                }
                
                const estavaConfirmado = confirmadosList.includes(userTag);
                
                removeUserFromLists(userTag);

                if (estavaConfirmado && reservasList !== '*Ninguém na reserva.*') {
                    const reservasArray = reservasList.split('\n');
                    const primeiroDaReserva = reservasArray.shift(); 
                    
                    if (primeiroDaReserva) {
                        confirmadosList = confirmadosList === '*Ninguém confirmado ainda.*' ? primeiroDaReserva : `${confirmadosList}\n${primeiroDaReserva}`;
                        reservasList = reservasArray.length > 0 ? reservasArray.join('\n') : '*Ninguém na reserva.*';
                        
                        try {
                            const userId = primeiroDaReserva.match(/<@(\d+)>/)[1];
                            const userToNotify = await client.users.fetch(userId);
                            await userToNotify.send(`Você foi promovido da reserva para a lista de confirmados da ação: "${originalEmbed.title}"`);
                        } catch(e) {
                            console.error("Falha ao notificar usuário da reserva.", e.message);
                        }
                    }
                }
                
                replyContent = 'Presença cancelada.';
            }
            
            if (customId === 'reserva_presenca') {
                 if (isUserInAnyList(userTag)) {
                     if (reservasList.includes(userTag)) {
                        return interaction.editReply({ content: 'Você já está na lista de reserva!' });
                     }
                     removeUserFromLists(userTag);
                }
                
                reservasList = reservasList === '*Ninguém na reserva.*' ? `- ${userEntry}` : `${reservasList}\n- ${userEntry}`;
                replyContent = 'Você foi adicionado à lista de reserva.';
            }
            
            
            const confirmadosCount = confirmadosList === '*Ninguém confirmado ainda.*' ? 0 : confirmadosList.split('\n').length;
            const reservasCount = reservasList === '*Ninguém na reserva.*' ? 0 : reservasList.split('\n').length;
            
            const newConfirmadosField = { name: `:white_check_mark: Confirmados (${confirmadosCount}/${max}):`, value: confirmadosList };
            const newReservasField = { name: `:pushpin: Reservas (${reservasCount}):`, value: reservasList };
            let newVagasField = fields.find(f => f.name === ':busts_in_silhouette: Vagas');
            newVagasField.value = `(${confirmadosCount}/${max})`; 
            
            const updatedEmbed = EmbedBuilder.from(originalEmbed)
                .setFields(
                    fields.find(f => f.name === ':date: Data'),
                    fields.find(f => f.name === ':alarm_clock: Horário'),
                    newVagasField,
                    { name: '\u200B', value: '\u200B' },
                    newConfirmadosField,
                    newReservasField
                );
            
            await message.edit({ embeds: [updatedEmbed] });
            await interaction.editReply({content: replyContent });
            
        }
    } catch (error) {
        // [CORREÇÃO AQUI] try/catch agora apanha o erro 10062
        console.error('Ocorreu um erro ao processar uma interação:', error);
        
        // Se for o erro 10062, apenas avisa e não crasha
        if (error.code === 10062) {
            console.warn('Erro 10062 (Unknown Interaction) detetado e ignorado. Interação provavelmente expirou ou era "fantasma".');
            // Tenta responder ao usuário que algo falhou, se possível
            if (!interaction.replied && !interaction.deferred) {
                try {
                    await interaction.reply({ content: 'Esta interação expirou ou é inválida. Tente novamente.', flags: [MessageFlags.Ephemeral] });
                } catch (e) {
                    console.error('Não foi possível nem responder à interação falhada.', e);
                }
            }
            return; // Impede o crash
        }
        
        // Para outros erros, tenta responder
        if (interaction.replied || interaction.deferred) {
            await interaction.followUp({ content: 'Ocorreu um erro ao processar sua solicitação.', flags: [MessageFlags.Ephemeral] });
        } else {
            try {
                await interaction.reply({ content: 'Ocorreu um erro. Tente novamente.', flags: [MessageFlags.Ephemeral] });
            } catch (err) {
                console.error('Erro ao tentar responder a uma interação com falha:', err);
            }
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
    
    // Pega o título original sem a parte da ação (Ex: "Patrulha no Sul - Policia")
    const tituloLimpo = originalEmbed.title.replace(':dart: Ação: ', '');

    const updatedEmbed = EmbedBuilder.from(originalEmbed)
        .setTitle(`[ENCERRADA] ${tituloLimpo}`)
        .setColor(0x808080) // Cor cinza
        .setDescription(':loudspeaker: **Ação Encerrada.**'); // Limpa a descrição

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


// --- [CORREÇÃO AQUI] Rede de segurança global para "Unhandled Rejections" ---
// Isto vai apanhar erros (como o 10062) que "borbulham" e causam crashes.
process.on('unhandledRejection', error => {
    console.error('Unhandled promise rejection:', error);
    
    // Especificamente para o erro 10062, nós o registamos mas não crashamos o bot.
    if (error && typeof error === 'object' && 'code' in error && error.code === 10062) {
        console.warn('IGNORANDO ERRO 10062 (Unknown Interaction). O bot não vai reiniciar.');
        return; // Impede o crash
    }
    
    // Para outros erros, é melhor deixar o Render reiniciar o bot.
    // Mas, por segurança, podemos apenas registar:
    console.error('Um erro não tratado sério ocorreu. O Render deve reiniciar o bot.');
});
// --- FIM DA REDE DE SEGURANÇA ---


// Faz o login do bot usando o token
client.login(token);

