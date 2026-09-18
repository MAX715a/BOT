const { 
  Client, 
  GatewayIntentBits, 
  Partials, 
  EmbedBuilder, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle, 
  PermissionFlagsBits, 
  ChannelType 
} = require('discord.js');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ],
  partials: [Partials.Channel, Partials.Message]
});

// ==================== [ تحديد الإعدادات ] ====================
const CONFIG = {
  TOKEN: 'ضع_توكن_البوت_هنا',
  WELCOME_CHANNEL_ID: 'ضع_آيدي_روم_الترحيب',
  AUTO_ROLE_ID: 'ضع_آيدي_الرتبة_التلقائية',
  LOG_CHANNEL_ID: 'ضع_آيدي_روم_السجلات',
  TICKET_CATEGORY_ID: 'ضع_آيدي_كتيجوري_التذاكر',
  SUPPORT_ROLE_ID: 'ضع_آيدي_روم_أو_رتبة_الدعم'
};

// ==================== [ تشغيل البوت وإرسال لوحة التكت ] ====================
client.once('ready', async () => {
  console.log(`[ONLINE] تم تشغيل البوت بنجاح باسم: ${client.user.tag}`);

  // تغيير حالة البوت
  client.user.setActivity('سيرفر النظام | System Bot', { type: 3 });
});

// أمر إنشاء لوحة التذاكر (!setup-ticket)
client.on('messageCreate', async (message) => {
  if (message.author.bot || !message.guild) return;

  if (message.content === '!setup-ticket') {
    if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return message.reply('عذراً، هذا الأمر مخصص للمسؤولين فقط.');
    }

    const embed = new EmbedBuilder()
      .setTitle('🎫 نظام الدعم الفني والتذاكر')
      .setDescription('اضغط على الزر أدناه لفتح تذكرة جديدة والتواصل مع فريق الدعم الفني.')
      .setColor('#5865F2')
      .setFooter({ text: message.guild.name, iconURL: message.guild.iconURL() });

    const button = new ButtonBuilder()
      .setCustomId('create_ticket')
      .setLabel('فتح تذكرة')
      .setEmoji('📩')
      .setStyle(ButtonStyle.Primary);

    const row = new ActionRowBuilder().addComponents(button);

    await message.channel.send({ embeds: [embed], components: [row] });
    await message.delete().catch(() => {});
  }
});

// ==================== [ نظام الترحيب والرتبة التلقائية ] ====================
client.on('guildMemberAdd', async (member) => {
  // إضافة رتبة تلقائية
  try {
    if (CONFIG.AUTO_ROLE_ID) {
      await member.roles.add(CONFIG.AUTO_ROLE_ID);
    }
  } catch (err) {
    console.error('خطأ في إعطاء الرتبة التلقائية:', err);
  }

  // إرسال رسالة الترحيب
  const welcomeChannel = member.guild.channels.cache.get(CONFIG.WELCOME_CHANNEL_ID);
  if (welcomeChannel) {
    const embed = new EmbedBuilder()
      .setTitle('👋 عضو جديد انضم للسيرفر!')
      .setDescription(`مرحباً بك ${member} في **${member.guild.name}**!\nأنت العضو رقم **${member.guild.memberCount}**.`)
      .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
      .setColor('#2ECC71')
      .setTimestamp();

    welcomeChannel.send({ embeds: [embed] });
  }

  // تسجيل دخول العضو في السجلات
  sendLog(member.guild, '📥 دخول عضو جديد', `العضو: ${member.user.tag} (${member.id})\nحساب أنشئ في: <t:${Math.floor(member.user.createdTimestamp / 1000)}:R>`, '#2ECC71');
});

// ==================== [ نظام التذاكر (Tickets) ] ====================
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isButton()) return;

  // 1. فتح تذكرة
  if (interaction.customId === 'create_ticket') {
    const existingChannel = interaction.guild.channels.cache.find(c => c.name === `ticket-${interaction.user.username.toLowerCase().replace(/[^a-z0-9]/g, '')}`);
    if (existingChannel) {
      return interaction.reply({ content: `لديك تذكرة مفتوحة بالفعل: ${existingChannel}`, ephemeral: true });
    }

    const channel = await interaction.guild.channels.create({
      name: `ticket-${interaction.user.username}`,
      type: ChannelType.GuildText,
      parent: CONFIG.TICKET_CATEGORY_ID || null,
      permissionOverwrites: [
        { id: interaction.guild.id, deny: [PermissionFlagsBits.ViewChannel] },
        { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.AttachFiles] },
        { id: CONFIG.SUPPORT_ROLE_ID, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }
      ]
    });

    const embed = new EmbedBuilder()
      .setTitle(`تذكرة - ${interaction.user.username}`)
      .setDescription('أهلاً بك! يرجى كتابة مشكلتك هنا وسيقوم فريق الدعم بالرد عليك في أقرب وقت.')
      .setColor('#3498DB');

    const closeButton = new ButtonBuilder()
      .setCustomId('close_ticket')
      .setLabel('إغلاق التذكرة')
      .setEmoji('🔒')
      .setStyle(ButtonStyle.Danger);

    const row = new ActionRowBuilder().addComponents(closeButton);

    await channel.send({ content: `${interaction.user} | <@&${CONFIG.SUPPORT_ROLE_ID}>`, embeds: [embed], components: [row] });
    await interaction.reply({ content: `تم إنشاء التذكرة بنجاح: ${channel}`, ephemeral: true });

    sendLog(interaction.guild, '🎫 تم فتح تذكرة', `المستخدم: ${interaction.user.tag}\nالروم: ${channel.name}`, '#3498DB');
  }

  // 2. إغلاق التذكرة
  if (interaction.customId === 'close_ticket') {
    await interaction.reply('سيتم إغلاق التذكرة خلال 5 ثوانٍ...');
    setTimeout(async () => {
      sendLog(interaction.guild, '🔒 تم إغلاق تذكرة', `الروم: ${interaction.channel.name}\nبواسطة: ${interaction.user.tag}`, '#E74C3C');
      await interaction.channel.delete().catch(() => {});
    }, 5000);
  }
});

// ==================== [ سجلات الرسائل (Logs) ] ====================
// سجل حذف الرسائل
client.on('messageDelete', async (message) => {
  if (!message.guild || message.author?.bot) return;

  sendLog(
    message.guild,
    '🗑️ حذف رسالة',
    `**صاحب الرسالة:** ${message.author?.tag || 'غير معروف'}\n**الروم:** ${message.channel}\n**المحتوى:** ${message.content || 'لا يوجد نص (صورة أو ملف)'}`,
    '#E74C3C'
  );
});

// سجل خروج الأعضاء
client.on('guildMemberRemove', async (member) => {
  sendLog(member.guild, '📤 مغادرة عضو', `العضو: ${member.user.tag} (${member.id})`, '#E67E22');
});

// دالة مساعدة لإرسال السجلات
function sendLog(guild, title, description, color) {
  const logChannel = guild.channels.cache.get(CONFIG.LOG_CHANNEL_ID);
  if (!logChannel) return;

  const embed = new EmbedBuilder()
    .setTitle(title)
    .setDescription(description)
    .setColor(color)
    .setTimestamp();

  logChannel.send({ embeds: [embed] }).catch(() => {});
}

// ==================== [ أوامر الإدارة الأساسية ] ====================
client.on('messageCreate', async (message) => {
  if (message.author.bot || !message.guild || !message.content.startsWith('!')) return;

  const args = message.content.slice(1).trim().split(/ +/);
  const command = args.shift().toLowerCase();

  // أمر مسح الرسائل (!clear)
  if (command === 'clear') {
    if (!message.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
      return message.reply('لا تملك صلاحية إدارة الرسائل.');
    }
    const amount = parseInt(args[0]);
    if (isNaN(amount) || amount < 1 || amount > 100) {
      return message.reply('يرجى تحديد عدد الرسائل بين 1 و 100.');
    }

    await message.channel.bulkDelete(amount, true);
    const msg = await message.channel.send(`تم مسح ${amount} رسالة بنجاح.`);
    setTimeout(() => msg.delete().catch(() => {}), 3000);
  }

  // أمر البان (!ban)
  if (command === 'ban') {
    if (!message.member.permissions.has(PermissionFlagsBits.BanMembers)) {
      return message.reply('لا تملك صلاحية حظر الأعضاء.');
    }
    const member = message.mentions.members.first();
    if (!member) return message.reply('يرجى تحديد العضو المراد حظره.');
    if (!member.bannable) return message.reply('لا يمكنني حظر هذا العضو.');

    const reason = args.slice(1).join(' ') || 'بدون سبب';
    await member.ban({ reason });
    message.reply(`تم حظر العضو ${member.user.tag} بنجاح.`);
  }
});

client.login(CONFIG.TOKEN);
