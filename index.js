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
                // [CORREÇÃO AQUI] Emoji ⚠️ usado diretamente
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
            // Nota: este agendamento não é persistente. Se o bot for reiniciado, o agendamento é perdido.
            try {
                const dataRegex = /^\d{2}\/\d{2}\/\d{4}$/;
                const horarioRegex = /^\d{2}:\d{2}$/;

                if (dataRegex.test(data) && horarioRegex.test(horario)) {
                    const [day, month, year] = data.split('/');
                    const [hour, minute] = horario.split(':');
                    
                    // Ajuste para fuso horário (Ex: -3 para BRT)
                    // Isso ajuda a alinhar o horário do servidor (geralmente UTC) com o horário local
                    const fusoHorarioOffsetHoras = -3; 
                    
                    // Cria a data no fuso horário local
                    const eventDate = new Date(year, month - 1, day, hour, minute);
                    
                    // Converte a data do evento para o fuso correto (Ex: 21:00 BRT -> UTC)
                    // Esta lógica simples pode não ser perfeita, mas ajuda.
                    // Estamos assumindo que o servidor roda em UTC.
                    
                    const now = new Date();
                    // [CORREÇÃO NA LÓGICA DE FUSO] A lógica de fuso estava invertida.
                    // Queremos a data do evento em UTC.
                    // Se o usuário digita 20:00 (BRT, -3), o UTC real é 23:00.
                    // new Date() no JS cria a data no fuso do servidor.
                    // Assumindo que o servidor é UTC e o usuário digita em BRT (-3)
                    // eventDate (20:00 UTC) - now (UTC)
                    // Precisamos que eventDate seja 23:00 UTC.
                    
                    // Solução mais simples: assumir que o usuário digita a hora do servidor (UTC)
                    // ou que o fuso do servidor do Render está em BRT (o que é improvável).
                    
                    // Vamos tentar uma lógica de fuso mais direta:
                    const eventDateInput = new Date(`${year}-${month}-${day}T${hour}:${minute}:00`);
                    
                    // Se o servidor for UTC, eventDateInput será "20:00 UTC".
                    // Se o usuário quis dizer "20:00 BRT" (UTC-3), o tempo real em UTC é 23:00 UTC.
                    // A diferença é de -3 horas.
                    
                    // Vamos assumir que a hora do servidor Render é UTC.
                    // E que o usuário digita a hora local (BRT/AMT, etc. - Vamos usar -3)
                    
                    // 1. Cria a data como se fosse UTC
                    const eventDateUTC = Date.UTC(year, month - 1, day, hour, minute);
                    // 2. Subtrai o fuso horário para "corrigir" para o UTC real
                    // Ex: Usuário digita 20:00 (BRT, -3).
                    // eventDateUTC é o timestamp para "20:00 UTC".
                    // Queremos o timestamp para "23:00 UTC".
                    // Devemos SUBTRAIR o offset (-3).
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
            
            // Pega os novos dados do modal
            const nomeAcao = interaction.fields.getTextInputValue('nomeAcaoInput');
            const faccao = interaction.fields.getTextInputValue('faccaoInput');
            const data = interaction.fields.getTextInputValue('dataInput');
            const horario = interaction.fields.getTextInputValue('horarioInput');
            const vagas = parseInt(interaction.fields.getTextInputValue('vagasInput'), 10);
            
            // [CORREÇÃO AQUI] Lógica de remoção de usuário removida deste modal
            // const removerUsuarioTag = interaction.fields.getTextInputValue('removerUsuarioInput') || null;

            if (isNaN(vagas) || vagas <= 0) {
                return interaction.editReply({ content: 'A quantidade de vagas deve ser um número maior que zero.', flags: [MessageFlags.Ephemeral] });
            }

            let confirmadosField = oldEmbed.fields.find(f => f.name.startsWith(':white_check_mark:'));
            let reservasField = oldEmbed.fields.find(f => f.name.startsWith(':pushpin:'));
            
            // [CORREÇÃO AQUI] Lógica de remoção removida
            // if (removerUsuarioTag) { ... }

            // Atualiza o contador de vagas no campo de confirmados (caso o admin mude o total)
            const confirmadosCount = confirmadosField.value === '*Ninguém confirmado ainda.*' ? 0 : confirmadosField.value.split('\n').length;
            confirmadosField.name = `:white_check_mark: Confirmados (${confirmadosCount}/${vagas}):`;

            // Atualiza o contador de vagas no campo de Vagas
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
        
        // Verifica se a ação já está encerrada
        if (originalEmbed.title.includes('[ENCERRADA]')) {
             return interaction.reply({ content: 'Esta ação já foi encerrada.', flags: [MessageFlags.Ephemeral] });
        }
        
        const userTag = interaction.user.tag; // Ex: "fulano#1234"
        const userMention = interaction.user.toString(); // Ex: "<@123456789>"

        const fields = originalEmbed.fields;
        
        let vagasField = fields.find(f => f.name === ':busts_in_silhouette: Vagas');
        let confirmadosField = fields.find(f => f.name.startsWith(':white_check_mark:'));
        let reservasField = fields.find(f => f.name.startsWith(':pushpin:'));

        const [current, max] = confirmadosField.name.match(/(\d+)/g).map(Number);
        
        let confirmadosList = confirmadosField.value;
        let reservasList = reservasField.value;

        // Função para checar se o usuário está em CQUALQUER lista
        const isUserInAnyList = (tag) => {
            return confirmadosList.includes(tag) || reservasList.includes(tag);
        };
        
        // Função para remover usuário de qualquer lista (usando a tag)
        const removeUserFromLists = (tag) => {
             let listChanged = false;
             // Remove de confirmados
             if (confirmadosList.includes(tag)) {
                 const lines = confirmadosList.split('\n');
                 const newLines = lines.filter(line => !line.includes(tag));
                 confirmadosList = newLines.length > 0 ? newLines.join('\n') : '*Ninguém confirmado ainda.*';
                 listChanged = true;
             }
             // Remove de reservas
             if (reservasList.includes(tag)) {
                 const lines = reservasList.split('\n');
                 const newLines = lines.filter(line => !line.includes(tag));
                 reservasList = newLines.length > 0 ? newLines.join('\n') : '*Ninguém na reserva.*';
                 listChanged = true;
             }
             return listChanged;
        };

        const userEntry = `${userMention} (${userTag})`; // Salva o @nome e a tag

        if (customId === 'confirmar_presenca') {
            if (isUserInAnyList(userTag)) {
                 if(confirmadosList.includes(userTag)) {
                    return interaction.reply({ content: 'Você já está na lista de confirmados!', flags: [MessageFlags.Ephemeral] });
                 }
                 // Se estava na reserva, remove da reserva
                 removeUserFromLists(userTag);
            }
            
            if (current >= max) {
                // Vagas cheias, tenta adicionar na reserva
                reservasList = reservasList === '*Ninguém na reserva.*' ? `- ${userEntry}` : `${reservasList}\n- ${userEntry}`;
                interaction.reply({ content: 'As vagas estão esgotadas! Você foi adicionado à lista de reserva.', flags: [MessageFlags.Ephemeral] });
            } else {
                // Adiciona em confirmados
                confirmadosList = confirmadosList === '*Ninguém confirmado ainda.*' ? `- ${userEntry}` : `${confirmadosList}\n- ${userEntry}`;
                interaction.reply({ content: 'Presença confirmada!', flags: [MessageFlags.Ephemeral] });
            }
        }

        if (customId === 'cancelar_presenca') {
            if (!isUserInAnyList(userTag)) {
                return interaction.reply({ content: 'Você não estava em nenhuma lista para cancelar.', flags: [MessageFlags.Ephemeral] });
            }
            
            const estavaConfirmado = confirmadosList.includes(userTag);
            
            // Remove o usuário de qualquer lista em que ele esteja
            removeUserFromLists(userTag);

            // Lógica de "puxar" da reserva
            // Só puxa se quem saiu estava na lista de confirmados
            if (estavaConfirmado && reservasList !== '*Ninguém na reserva.*') {
                const reservasArray = reservasList.split('\n');
                const primeiroDaReserva = reservasArray.shift(); // Pega o primeiro
                
                if (primeiroDaReserva) {
                     // Adiciona o primeiro da reserva aos confirmados
                    confirmadosList = confirmadosList === '*Ninguém confirmado ainda.*' ? primeiroDaReserva : `${confirmadosList}\n${primeiroDaReserva}`;
                    
                    // Remove o primeiro da reserva da lista de reservas
                    reservasList = reservasArray.length > 0 ? reservasArray.join('\n') : '*Ninguém na reserva.*';
                    
                    // Tenta notificar o usuário promovido (opcional)
                    try {
                        const userId = primeiroDaReserva.match(/<@(\d+)>/)[1];
                        const userToNotify = await client.users.fetch(userId);
                        await userToNotify.send(`Você foi promovido da reserva para a lista de confirmados da ação: "${originalEmbed.title}"`);
                    } catch(e) {
                        console.error("Falha ao notificar usuário da reserva.", e.message);
                    }
                }
            }
            
            await interaction.reply({ content: 'Presença cancelada.', flags: [MessageFlags.Ephemeral] });
        }
        
        if (customId === 'reserva_presenca') {
             if (isUserInAnyList(userTag)) {
                 if (reservasList.includes(userTag)) {
                    return interaction.reply({ content: 'Você já está na lista de reserva!', flags: [MessageFlags.Ephemeral] });
                 }
                 // Se estava confirmado, remove de confirmado
                 removeUserFromLists(userTag);
            }
            
            // Adiciona na reserva
            reservasList = reservasList === '*Ninguém na reserva.*' ? `- ${userEntry}` : `${reservasList}\n- ${userEntry}`;
            await interaction.reply({ content: 'Você foi adicionado à lista de reserva.', flags: [MessageFlags.Ephemeral] });
        }
        
        // --- Lógica de Edição e Encerramento (Permissão Necessária) ---
        
        // Função para checar a permissão (Admin OU o cargo específico)
        const hasPermission = () => {
             if (interaction.member.permissions.has(PermissionFlagsBits.Administrator)) return true;
             if (interaction.member.roles.cache.some(role => role.name === requiredRoleName)) return true;
             return false;
        };
        
        if (customId === 'editar_acao') {
            if (!hasPermission()) {
                return interaction.reply({ content: `Você não tem permissão para editar. Apenas Administradores ou cargos "${requiredRoleName}".`, flags: [MessageFlags.Ephemeral] });
            }
            
            // [CORREÇÃO AQUI] Regex mais seguro
            const titleMatch = originalEmbed.title.match(/Ação: (.*) - (.*)/);
            if (!titleMatch) {
                 console.error("Regex do título falhou ao editar:", originalEmbed.title);
                 return interaction.reply({ content: 'Erro ao ler o título da ação para edição.', flags: [MessageFlags.Ephemeral] });
            }
            const nomeAcao = titleMatch[1];
            const faccao = titleMatch[2];
            
            const dataValue = fields.find(f => f.name === ':date: Data').value;
            const horarioValue = fields.find(f => f.name === ':alarm_clock: Horário').value;
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
                // [CORREÇÃO AQUI] 6º campo removido para evitar crash
                // new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('removerUsuarioInput').setLabel("Remover Usuário (Opcional)").setPlaceholder("Digite o Nome#Tag do usuário").setStyle(TextInputStyle.Short).setRequired(false))
            );
            
            await interaction.showModal(modal);
        }

        if (customId === 'encerrar_acao') {
             if (!hasPermission()) {
                return interaction.reply({ content: `Você não tem permissão para encerrar. Apenas Administradores ou cargos "${requiredRoleName}".`, flags: [MessageFlags.Ephemeral] });
            }
            await encerrarAcao(message);
            await interaction.reply({ content: 'Ação encerrada com sucesso!', flags: [MessageFlags.Ephemeral] });
        }
        
        // --- Atualiza o Embed após qualquer clique em botão (exceto modais) ---
        if (interaction.isButton() && customId !== 'editar_acao') {
            // Recalcula contagens
            const confirmadosCount = confirmadosList === '*Ninguém confirmado ainda.*' ? 0 : confirmadosList.split('\n').length;
            const reservasCount = reservasList === '*Ninguém na reserva.*' ? 0 : reservasList.split('\n').length;
            
            // Recria os campos
            const newConfirmadosField = { name: `:white_check_mark: Confirmados (${confirmadosCount}/${max}):`, value: confirmadosList };
            const newReservasField = { name: `:pushpin: Reservas (${reservasCount}):`, value: reservasList };
            let newVagasField = fields.find(f => f.name === ':busts_in_silhouette: Vagas');
            newVagasField.value = `(${confirmadosCount}/${max})`; // Atualiza o campo de vagas original
            
            const updatedEmbed = EmbedBuilder.from(originalEmbed)
                .setFields(
                    fields.find(f => f.name === ':date: Data'),
                    fields.find(f => f.name === ':alarm_clock: Horário'),
                    newVagasField,
                    { name: '\u200B', value: '\u200B' },
                    newConfirmadosField,
                    newReservasField
                );
            
            // Só edita se a interação não foi respondida ainda (evita crash "interaction has already been replied")
            if (!interaction.replied && !interaction.deferred) {
                 await message.edit({ embeds: [updatedEmbed] });
            } else if (interaction.deferred) {
                 await interaction.editReply({content: 'Ação processada.', flags: [MessageFlags.Ephemeral]}); // Responde ao defer
                 await message.edit({ embeds: [updatedEmbed] }); // Edita a mensagem original
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


// Faz o login do bot usando o token
client.login(token);

