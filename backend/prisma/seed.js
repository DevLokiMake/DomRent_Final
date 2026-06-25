import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('[seed] Starting...');

  // ── Admin (always upsert) ────────────────────────────────────────────────────
  const adminHash = await bcrypt.hash('admin123', 10);
  await prisma.user.upsert({
    where: { email: 'admin@domrent.kz' },
    update: {},
    create: { email: 'admin@domrent.kz', password: adminHash, name: 'Администратор', role: 'ADMIN' },
  });
  console.log('[seed] Admin ready: admin@domrent.kz / admin123');

  // ── Approve all PENDING properties ──────────────────────────────────────────
  const approved = await prisma.property.updateMany({
    where: { status: 'PENDING' },
    data: { status: 'APPROVED' },
  });
  if (approved.count > 0) {
    console.log(`[seed] Approved ${approved.count} pending properties`);
  }

  // ── Skip sample data if properties already exist ─────────────────────────────
  const count = await prisma.property.count();
  if (count > 0) {
    console.log(`[seed] ${count} properties exist — skipping sample data`);
    return;
  }

  // ── Cities ───────────────────────────────────────────────────────────────────
  const cityNames = ['Алматы', 'Астана', 'Шымкент', 'Актобе', 'Актау'];
  const cities = {};
  for (const name of cityNames) {
    const city = await prisma.city.upsert({ where: { name }, update: {}, create: { name } });
    cities[name] = city;
  }

  // ── Landlord ─────────────────────────────────────────────────────────────────
  const landlordHash = await bcrypt.hash('landlord123', 10);
  const landlord = await prisma.user.upsert({
    where: { email: 'landlord@domrent.kz' },
    update: {},
    create: { email: 'landlord@domrent.kz', password: landlordHash, name: 'Айбек Ерменов', phone: '+7 700 123 45 67', role: 'LANDLORD' },
  });

  // ── Sample properties (APPROVED) ─────────────────────────────────────────────
  const samples = [
    { title: 'Премиум квартира в центре Алматы', description: 'Современная квартира с панорамным видом. 2 спальни, балкон, кухня. Рядом парк и торговые центры.', price: 2500, type: 'квартира', contractType: 'RENT', cityName: 'Алматы', rooms: 2, hasWifi: true, hasParking: true, petsAllowed: false, latitude: 43.238949, longitude: 76.889709, coverImage: 'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800', images: ['https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800', 'https://images.unsplash.com/photo-1545324418-cc1a9a6fded0?w=800'] },
    { title: 'Уютная студия рядом с парком', description: '1-комнатная квартира на 8 этаже. Ремонт, мебель, техника. Тихий район.', price: 1500, type: 'квартира', contractType: 'RENT', cityName: 'Алматы', rooms: 1, hasWifi: true, hasParking: true, petsAllowed: true, latitude: 43.252312, longitude: 76.915267, coverImage: 'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=800', images: ['https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=800'] },
    { title: 'Просторный дом с садом', description: '3-этажный дом. 4 спальни, зал, кухня, гараж. Огороженный двор. Для семьи.', price: 4000, type: 'дом', contractType: 'RENT', cityName: 'Алматы', rooms: 4, hasWifi: true, hasParking: true, petsAllowed: true, latitude: 43.212341, longitude: 76.867543, coverImage: 'https://images.unsplash.com/photo-1570129477492-45a003537e1f?w=800', images: ['https://images.unsplash.com/photo-1570129477492-45a003537e1f?w=800', 'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=800'] },
    { title: 'Комната в центре для студентов', description: 'Комната в центре. Общая кухня. Подходит для студентов.', price: 800, type: 'комната', contractType: 'RENT', cityName: 'Алматы', rooms: 1, hasWifi: true, hasParking: false, petsAllowed: false, latitude: 43.257894, longitude: 76.923456, coverImage: 'https://images.unsplash.com/photo-1565183938294-7563f3ce68c5?w=800', images: ['https://images.unsplash.com/photo-1565183938294-7563f3ce68c5?w=800'] },
    { title: 'Люкс апартаменты с видом на Байтерек', description: 'Дизайнерский ремонт. 2 спальни, кухня-гостиная. Охрана, консьерж, фитнес.', price: 3500, type: 'квартира', contractType: 'RENT', cityName: 'Астана', rooms: 2, hasWifi: true, hasParking: true, petsAllowed: false, latitude: 51.180539, longitude: 71.445965, coverImage: 'https://images.unsplash.com/photo-1512917774080-9e6e7236fba2?w=800', images: ['https://images.unsplash.com/photo-1512917774080-9e6e7236fba2?w=800', 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800'] },
    { title: 'Стильная квартира в новом ЖК', description: '1-комнатная в комплексе. Современный интерьер, бассейн.', price: 2000, type: 'квартира', contractType: 'RENT', cityName: 'Астана', rooms: 1, hasWifi: true, hasParking: false, petsAllowed: false, latitude: 51.128208, longitude: 71.430420, coverImage: 'https://images.unsplash.com/photo-1540932239986-310128078ceb?w=800', images: ['https://images.unsplash.com/photo-1540932239986-310128078ceb?w=800'] },
    { title: 'Коттедж в закрытом комплексе', description: '3 спальни, кабинет, гостиная. Бассейн, гараж, охрана 24/7.', price: 5000, type: 'дом', contractType: 'RENT', cityName: 'Астана', rooms: 3, hasWifi: true, hasParking: true, petsAllowed: false, latitude: 51.155432, longitude: 71.456789, coverImage: 'https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=800', images: ['https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=800'] },
    { title: 'Квартира в центре Шымкента', description: '2-комнатная после ремонта. Кондиционер, балкон, кухня.', price: 1200, type: 'квартира', contractType: 'RENT', cityName: 'Шымкент', rooms: 2, hasWifi: true, hasParking: false, petsAllowed: true, latitude: 42.317000, longitude: 69.590000, coverImage: 'https://images.unsplash.com/photo-1560448204-603b3fc33ddc?w=800', images: ['https://images.unsplash.com/photo-1560448204-603b3fc33ddc?w=800'] },
  ];

  for (const s of samples) {
    const { cityName, ...data } = s;
    const city = cities[cityName] || await prisma.city.upsert({ where: { name: cityName }, update: {}, create: { name: cityName } });
    await prisma.property.create({ data: { ...data, status: 'APPROVED', cityId: city.id, ownerId: landlord.id } });
    console.log(`[seed] Created: "${s.title}"`);
  }

  console.log('[seed] Done! Credentials: admin@domrent.kz/admin123 | landlord@domrent.kz/landlord123');
}

main()
  .catch(e => { console.error('[seed] Failed:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
