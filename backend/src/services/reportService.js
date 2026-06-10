import PDFDocument from 'pdfkit';

const BRAND = '#f43f5e';
const GRAY = '#6b7280';
const LIGHT = '#f9fafb';
const DARK = '#111827';

/** Форматирует число как деньги ₸ */
const formatMoney = (n) => `${Math.round(n).toLocaleString('ru-RU')} ₸`;

/** Форматирует дату по-русски */
const formatDate = (d) =>
  new Date(d).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });

/**
 * Создаёт базовый PDF-документ с шапкой
 */
const createDoc = (title, subtitle) => {
  const doc = new PDFDocument({ margin: 50, size: 'A4' });

  // Шапка
  doc.rect(0, 0, doc.page.width, 80).fill(DARK);
  doc.fillColor('#ffffff')
    .fontSize(22)
    .font('Helvetica-Bold')
    .text('DomRent', 50, 22);
  doc.fontSize(11)
    .font('Helvetica')
    .text(title, 50, 50);

  // Подзаголовок
  doc.fillColor(DARK)
    .fontSize(16)
    .font('Helvetica-Bold')
    .text(subtitle, 50, 100);

  doc.fillColor(GRAY)
    .fontSize(10)
    .font('Helvetica')
    .text(`Дата генерации: ${new Date().toLocaleString('ru-RU')}`, 50, 122);

  doc.moveTo(50, 140).lineTo(doc.page.width - 50, 140).stroke(BRAND);

  doc.moveDown(2);
  return doc;
};

/**
 * Рисует строку таблицы
 */
const tableRow = (doc, y, cols, widths, isHeader = false) => {
  const rowH = 24;
  if (isHeader) {
    doc.rect(50, y, doc.page.width - 100, rowH).fill(BRAND);
    doc.fillColor('#fff').font('Helvetica-Bold').fontSize(9);
  } else {
    doc.fillColor(DARK).font('Helvetica').fontSize(9);
  }

  let x = 50;
  cols.forEach((text, i) => {
    doc.text(String(text || '—'), x + 4, y + 7, { width: widths[i] - 8, lineBreak: false });
    x += widths[i];
  });

  if (!isHeader) {
    doc.moveTo(50, y + rowH).lineTo(doc.page.width - 50, y + rowH).stroke('#e5e7eb');
  }

  return y + rowH;
};

/**
 * Рисует блок-карточку статистики
 */
const statBlock = (doc, x, y, label, value) => {
  doc.rect(x, y, 120, 50).fill(LIGHT);
  doc.fillColor(BRAND).fontSize(20).font('Helvetica-Bold')
    .text(value, x + 8, y + 8, { width: 104 });
  doc.fillColor(GRAY).fontSize(9).font('Helvetica')
    .text(label, x + 8, y + 32, { width: 104 });
};

// ─── Генераторы отчётов ───────────────────────────────────────────────────────

/**
 * Отчёт по пользователям (для Администратора)
 */
export const generateUsersReport = (users, stats) => {
  const doc = createDoc('Административный отчёт', 'Отчёт по пользователям');

  // Блоки статистики
  statBlock(doc, 50, doc.y, 'Всего пользователей', stats.totalUsers);
  statBlock(doc, 185, doc.y, 'Арендодателей', stats.landlords || 0);
  statBlock(doc, 320, doc.y, 'Новых за 7 дней', stats.newUsers7d || 0);
  statBlock(doc, 455, doc.y, 'Заблокированных', stats.bannedUsers || 0);

  doc.moveDown(5);

  // Таблица пользователей
  const colW = [30, 160, 120, 80, 80, 75];
  let y = doc.y + 10;
  y = tableRow(doc, y, ['#', 'Email', 'Имя', 'Роль', 'Брони', 'Объекты'], colW, true);

  users.slice(0, 50).forEach((u, i) => {
    if (y > doc.page.height - 80) {
      doc.addPage();
      y = 50;
      y = tableRow(doc, y, ['#', 'Email', 'Имя', 'Роль', 'Брони', 'Объекты'], colW, true);
    }
    const bg = i % 2 === 0 ? '#fff' : LIGHT;
    doc.rect(50, y, doc.page.width - 100, 24).fill(bg);
    y = tableRow(doc, y, [
      i + 1,
      u.email,
      u.name || '—',
      u.role,
      u._count?.bookings || 0,
      u._count?.properties || 0,
    ], colW);
  });

  return doc;
};

/**
 * Отчёт по бронированиям (для Администратора или Арендодателя)
 */
export const generateBookingsReport = (bookings, stats) => {
  const doc = createDoc('Отчёт по бронированиям', 'Статистика бронирований');

  statBlock(doc, 50, doc.y, 'Всего бронирований', stats.total || bookings.length);
  statBlock(doc, 185, doc.y, 'Завершённых', stats.completed || 0);
  statBlock(doc, 320, doc.y, 'Доход платформы', formatMoney(stats.totalRevenue || 0));
  statBlock(doc, 455, doc.y, 'Средняя сумма', formatMoney(stats.avgPrice || 0));

  doc.moveDown(5);

  const colW = [30, 130, 100, 90, 90, 75];
  let y = doc.y + 10;
  y = tableRow(doc, y, ['#', 'Объект', 'Гость', 'Заезд', 'Выезд', 'Сумма'], colW, true);

  bookings.slice(0, 100).forEach((b, i) => {
    if (y > doc.page.height - 80) {
      doc.addPage();
      y = 50;
      y = tableRow(doc, y, ['#', 'Объект', 'Гость', 'Заезд', 'Выезд', 'Сумма'], colW, true);
    }
    const bg = i % 2 === 0 ? '#fff' : LIGHT;
    doc.rect(50, y, doc.page.width - 100, 24).fill(bg);
    y = tableRow(doc, y, [
      i + 1,
      b.property?.title || '—',
      b.user?.name || b.user?.email || '—',
      formatDate(b.startDate),
      formatDate(b.endDate),
      formatMoney(b.totalPrice),
    ], colW);
  });

  // Итог
  doc.moveDown(2);
  const totalRevenue = bookings.reduce((s, b) => s + (b.totalPrice || 0), 0);
  doc.fillColor(DARK).font('Helvetica-Bold').fontSize(12)
    .text(`Итого доход: ${formatMoney(totalRevenue)}`, 50, doc.y);

  return doc;
};

/**
 * Отчёт по объектам недвижимости
 */
export const generatePropertiesReport = (properties) => {
  const doc = createDoc('Отчёт по объектам', 'Статистика объявлений');

  const approved = properties.filter(p => p.status === 'APPROVED').length;
  const pending = properties.filter(p => p.status === 'PENDING').length;

  statBlock(doc, 50, doc.y, 'Всего объектов', properties.length);
  statBlock(doc, 185, doc.y, 'Одобрено', approved);
  statBlock(doc, 320, doc.y, 'На модерации', pending);
  statBlock(doc, 455, doc.y, 'Городов', new Set(properties.map(p => p.city?.name)).size);

  doc.moveDown(5);

  const colW = [30, 160, 80, 65, 65, 55, 55];
  let y = doc.y + 10;
  y = tableRow(doc, y, ['#', 'Название', 'Город', 'Тип', 'Цена', 'Брони', 'Отзывы'], colW, true);

  properties.slice(0, 80).forEach((p, i) => {
    if (y > doc.page.height - 80) {
      doc.addPage();
      y = 50;
      y = tableRow(doc, y, ['#', 'Название', 'Город', 'Тип', 'Цена', 'Брони', 'Отзывы'], colW, true);
    }
    const bg = i % 2 === 0 ? '#fff' : LIGHT;
    doc.rect(50, y, doc.page.width - 100, 24).fill(bg);
    y = tableRow(doc, y, [
      i + 1,
      p.title,
      p.city?.name || '—',
      p.type || '—',
      formatMoney(p.price),
      p._count?.bookings || 0,
      p._count?.reviews || 0,
    ], colW);
  });

  return doc;
};

/**
 * Финансовый отчёт (доход по месяцам)
 */
export const generateRevenueReport = (monthlyData, totalRevenue) => {
  const doc = createDoc('Финансовый отчёт', 'Доходы платформы');

  statBlock(doc, 50, doc.y, 'Итоговый доход', formatMoney(totalRevenue));
  statBlock(doc, 185, doc.y, 'Периодов', monthlyData.length);
  const avgMonthly = monthlyData.length > 0 ? totalRevenue / monthlyData.length : 0;
  statBlock(doc, 320, doc.y, 'Ср. за период', formatMoney(avgMonthly));

  doc.moveDown(5);

  const colW = [200, 160, 170];
  let y = doc.y + 10;
  y = tableRow(doc, y, ['Месяц', 'Бронирований', 'Доход'], colW, true);

  monthlyData.forEach((m, i) => {
    const bg = i % 2 === 0 ? '#fff' : LIGHT;
    doc.rect(50, y, doc.page.width - 100, 24).fill(bg);
    y = tableRow(doc, y, [m.month || m.date, m.bookings || m.count, formatMoney(m.revenue)], colW);
  });

  // Итог
  doc.moveDown(2);
  doc.fillColor(DARK).font('Helvetica-Bold').fontSize(13)
    .text(`Общий доход: ${formatMoney(totalRevenue)}`, 50, doc.y);

  return doc;
};

/**
 * Отчёт арендодателя по своим объектам
 */
export const generateLandlordReport = (properties, summary) => {
  const doc = createDoc('Отчёт арендодателя', 'Статистика моих объектов');

  statBlock(doc, 50, doc.y, 'Объектов', summary.totalProperties || properties.length);
  statBlock(doc, 185, doc.y, 'Просмотров', summary.totalViews || 0);
  statBlock(doc, 320, doc.y, 'Бронирований', summary.totalBookings || 0);
  statBlock(doc, 455, doc.y, 'Общий доход', formatMoney(summary.totalRevenue || 0));

  doc.moveDown(5);

  const colW = [30, 130, 65, 60, 65, 55, 60, 45];
  let y = doc.y + 10;
  y = tableRow(doc, y, ['#', 'Название', 'Город', 'Цена', 'Просм.', 'Брони', 'Доход', 'Рейтинг'], colW, true);

  properties.slice(0, 50).forEach((p, i) => {
    if (y > doc.page.height - 80) {
      doc.addPage();
      y = 50;
      y = tableRow(doc, y, ['#', 'Название', 'Город', 'Цена', 'Просм.', 'Брони', 'Доход', 'Рейтинг'], colW, true);
    }
    const bg = i % 2 === 0 ? '#fff' : LIGHT;
    doc.rect(50, y, doc.page.width - 100, 24).fill(bg);
    y = tableRow(doc, y, [
      i + 1,
      p.title,
      p.city || '—',
      formatMoney(p.price),
      p.viewCount || 0,
      p.bookingsCount || 0,
      formatMoney(p.revenue || 0),
      p.avgRating ? `${p.avgRating}/5` : '—',
    ], colW);
  });

  return doc;
};
