import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seed started...');

  // Skip if already seeded
  const existing = await prisma.property.count();
  if (existing > 0) {
    console.log(`✅ Already seeded (${existing} properties exist). Skipping.`);
    return;
  }

  // ── Cities ──────────────────────────────────────────────────────────────────
  console.log('🏙️  Creating cities...');
  const cityNames = ['Алматы', 'Астана', 'Шымкент', 'Актобе', 'Актау'];
  const cities = {};
  for (const name of cityNames) {
    const city = await prisma.city.upsert({
      where: { name },
      update: {},
      create: { name },
    });
    cities[name] = city;
  }

  // ── Admin ────────────────────────────────────────────────────────────────────
  console.log('👤 Creating admin...');
  const adminHash = await bcrypt.hash('admin123', 10);
  await prisma.user.upsert({
    where: { email: 'admin@domrent.kz' },
    update: {},
    create: {
      email: 'admin@domrent.kz',
      password: adminHash,
      name: 'Администратор',
      role: 'ADMIN',
    },
  });

  // ── Landlord ─────────────────────────────────────────────────────────────────
  console.log('🏠 Creating landlord...');
  const landlordHash = await bcrypt.hash('landlord123', 10);
  const landlord = await prisma.user.upsert({
    where: { email: 'landlord@domrent.kz' },
    update: {},
    create: {
      email: 'landlord@domrent.kz',
      password: landlordHash,
      name: 'Айбек Ерменов',
      phone: '+7 700 123 45 67',
      role: 'LANDLORD',
    },
  });

  // ── Properties ───────────────────────────────────────────────────────────────
  console.log('🏡 Creating properties...');

  const props = [
    {
      title: 'Премиум квартира в центре Алматы',
      description: 'Современная квартира с панорамным видом на город. 2 спальни, балкон, полностью оборудованная кухня. Рядом парк и торговые центры.',
      price: 2500,
      type: 'квартира',
      contractType: 'RENT',
      cityName: 'Алматы',
      rooms: 2,
      hasWifi: true,
      hasParking: true,
      petsAllowed: false,
      coverImage: 'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800',
      images: ['https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800', 'https://images.unsplash.com/photo-1545324418-cc1a9a6fded0?w=800'],
    },
    {
      title: 'Уютная студия рядом с парком',
      description: '1-комнатная квартира на 8 этаже. Ремонт, мебель, техника. Есть паркинг. Тихий район.',
      price: 1500,
      type: 'квартира',
      contractType: 'RENT',
      cityName: 'Алматы',
      rooms: 1,
      hasWifi: true,
      hasParking: true,
      petsAllowed: true,
      coverImage: 'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=800',
      images: ['https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=800'],
    },
    {
      title: 'Просторный дом с садом',
      description: 'Просторный 3-этажный дом. 4 спальни, зал, кухня, гараж. Огороженный двор. Идеально для семьи.',
      price: 4000,
      type: 'дом',
      contractType: 'RENT',
      cityName: 'Алматы',
      rooms: 4,
      hasWifi: true,
      hasParking: true,
      petsAllowed: true,
      coverImage: 'https://images.unsplash.com/photo-1570129477492-45a003537e1f?w=800',
      images: ['https://images.unsplash.com/photo-1570129477492-45a003537e1f?w=800', 'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=800'],
    },
    {
      title: 'Комната в центре — для студентов',
      description: 'Небольшая комната в центре города. Общая кухня и санузел. Подходит для студентов и молодых специалистов.',
      price: 800,
      type: 'комната',
      contractType: 'RENT',
      cityName: 'Алматы',
      rooms: 1,
      hasWifi: true,
      hasParking: false,
      petsAllowed: false,
      coverImage: 'https://images.unsplash.com/photo-1565183938294-7563f3ce68c5?w=800',
      images: ['https://images.unsplash.com/photo-1565183938294-7563f3ce68c5?w=800'],
    },
    {
      title: 'Люкс апартаменты с видом на Байтерек',
      description: 'Дизайнерский ремонт. 2 спальни, ванная, кухня-гостиная. Охрана, консьерж, фитнес-центр.',
      price: 3500,
      type: 'квартира',
      contractType: 'RENT',
      cityName: 'Астана',
      rooms: 2,
      hasWifi: true,
      hasParking: true,
      petsAllowed: false,
      coverImage: 'https://images.unsplash.com/photo-1512917774080-9e6e7236fba2?w=800',
      images: ['https://images.unsplash.com/photo-1512917774080-9e6e7236fba2?w=800', 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800'],
    },
    {
      title: 'Стильная квартира в новом ЖК',
      description: '1-комнатная квартира в популярном комплексе. Современный интерьер, техника, мебель. Доступ к бассейну.',
      price: 2000,
      type: 'квартира',
      contractType: 'RENT',
      cityName: 'Астана',
      rooms: 1,
      hasWifi: true,
      hasParking: false,
      petsAllowed: false,
      coverImage: 'https://images.unsplash.com/photo-1540932239986-310128078ceb?w=800',
      images: ['https://images.unsplash.com/photo-1540932239986-310128078ceb?w=800'],
    },
    {
      title: 'Коттедж в престижном районе',
      description: 'Современный коттедж в закрытом комплексе. 3 спальни, кабинет, гостиная, кухня. Бассейн, гараж, охрана 24/7.',
      price: 5000,
      type: 'дом',
      contractType: 'RENT',
      cityName: 'Астана',
      rooms: 3,
      hasWifi: true,
      hasParking: true,
      petsAllowed: false,
      coverImage: 'https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=800',
      images: ['https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=800', 'https://images.unsplash.com/photo-1567521464027-f127ff144326?w=800'],
    },
    {
      title: 'Квартира в центре Шымкента',
      description: '2-комнатная квартира после ремонта. Кондиционер, балкон, встроенная кухня. Инфраструктура рядом.',
      price: 1200,
      type: 'квартира',
      contractType: 'RENT',
      cityName: 'Шымкент',
      rooms: 2,
      hasWifi: true,
      hasParking: false,
      petsAllowed: true,
      coverImage: 'https://images.unsplash.com/photo-1560448204-603b3fc33ddc?w=800',
      images: ['https://images.unsplash.com/photo-1560448204-603b3fc33ddc?w=800'],
    },
  ];

  for (const p of props) {
    const { cityName, ...data } = p;
    await prisma.property.create({
      data: {
        ...data,
        status: 'APPROVED',
        cityId: cities[cityName].id,
        ownerId: landlord.id,
      },
    });
    console.log(`  ✅ "${p.title}"`);
  }

  console.log('\n✨ Seed complete!\n');
  console.log('Credentials:');
  console.log('  Admin:    admin@domrent.kz    / admin123');
  console.log('  Landlord: landlord@domrent.kz / landlord123');
}

main()
  .catch(e => { console.error('❌ Seed failed:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
