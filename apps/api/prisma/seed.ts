import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';

const prisma = new PrismaClient();

async function main() {
  // Create admin user. The password comes from SEED_ADMIN_PASSWORD, or is generated and
  // printed once; it's only set when the user is created, never on re-seed.
  const generated = !process.env.SEED_ADMIN_PASSWORD;
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? randomBytes(18).toString('base64url');
  const existingAdmin = await prisma.user.findUnique({ where: { email: 'admin@irs.az' } });
  const admin = await prisma.user.upsert({
    where: { email: 'admin@irs.az' },
    update: {},
    create: {
      email: 'admin@irs.az',
      username: 'admin',
      name: 'Admin',
      passwordHash: await bcrypt.hash(adminPassword, 12),
      role: 'SUPERADMIN',
      isVerified: true,
    },
  });

  if (!existingAdmin) {
    console.log('Created admin user:', admin.email);
    if (generated) console.log('Admin password (shown once, store it safely):', adminPassword);
  }

  // Seed Fuzuli
  const fuzuli = await prisma.author.upsert({
    where: { slug: 'fuzuli' },
    update: {},
    create: {
      slug: 'fuzuli',
      nameAz: 'Məhəmməd Füzuli',
      nameRu: 'Мухаммед Физули',
      nameFa: 'محمد فضولی',
      nameEn: 'Muhammad Fuzuli',
      bornYear: 1494,
      bornYearApprox: true,
      diedYear: 1556,
      type: 'POET',
      period: 'Klassik dövr',
      writingLangs: ['AZ_ARABIC', 'FA', 'AR'],
      bioAz:
        'Məhəmməd ibn Süleyman Füzuli — Azərbaycan və dünya ədəbiyyatının görkəmli nümayəndəsi, şair, mütəfəkkir. Klassik Azərbaycan poeziyasının ən böyük nümayəndələrindən biri hesab olunur.',
      bioRu:
        'Мухаммед ибн Сулейман Физули — выдающийся представитель азербайджанской и мировой литературы, поэт, мыслитель. Считается одним из величайших представителей классической азербайджанской поэзии.',
      status: 'PUBLISHED',
      featuredAt: new Date(),
    },
  });

  // Fuzuli's Divan collection
  const divan = await prisma.collection.upsert({
    where: { slug: 'fuzuli-divan' },
    update: {},
    create: {
      slug: 'fuzuli-divan',
      titleAz: 'Divan',
      titleRu: 'Диван',
      titleFa: 'دیوان',
      authorId: fuzuli.id,
      genre: 'POEM',
      originalLang: 'AZ_ARABIC',
      order: 1,
      status: 'PUBLISHED',
    },
  });

  // Sample ghazals
  const ghazals = [
    {
      slug: 'meni-candan-usandirdi',
      titleAz: 'Məni candan usandırdı',
      titleRu: 'Меня от жизни отвратила',
      body: `Məni candan usandırdı, cəfadan yar usanmazmı?
Fələklər yandı ahimdən, muradım şəmi yanmazmı?

Qamu bimarinə canan, dəvayi-dərd edər ehsan,
Niçin qılmaz mənə dərman, məni bimar sanmazmı?

Qəmim pünhan tutardım mən, dedilər yarə qıl rövşən,
Desəm ol bivəfa bilmən, inanarmı, inanmazmı?

Şəbi-hicran yanar canım, tökər qan çeşmi-giryanım,
Oyadar xəlqi əfğanım, qara bəxtim oyanmazmı?

Füzuli rindü şeydadır, həmişə xəlqə rüsvadır,
Sorun kim bu nə sevdadır, bu sevdadan usanmazmı?`,
      year: 1530,
      form: 'GHAZAL',
      order: 1,
    },
    {
      slug: 'ey-eşq-odi-ile',
      titleAz: 'Ey eşq, odilə yandır',
      body: `Ey eşq, odilə yandır məni, yarım usanmazmı?
Dərdə düşüb əl üzməz, ahım-zarım usanmazmı?

Gördüm cəmalın, ey yar, oldum giriftari-eşq,
Söylə ki, bu rəftar ilə, didarım usanmazmı?`,
      year: 1530,
      form: 'GHAZAL',
      order: 2,
    },
  ];

  for (const ghazal of ghazals) {
    await prisma.work.upsert({
      where: { slug: ghazal.slug },
      update: {},
      create: {
        slug: ghazal.slug,
        titleAz: ghazal.titleAz,
        titleRu: ghazal.titleRu ?? null,
        body: ghazal.body,
        bodyHtml: `<p>${ghazal.body.replace(/\n\n/g, '</p><p>').replace(/\n/g, '<br>')}</p>`,
        authorId: fuzuli.id,
        collectionId: divan.id,
        originalLang: 'AZ_ARABIC',
        scriptDirection: 'LTR', // modern Latin transcription
        genre: 'POEM',
        form: ghazal.form as any,
        year: ghazal.year,
        yearApprox: true,
        order: ghazal.order,
        status: 'PUBLISHED',
      },
    });
  }

  // Add a Russian translation for the first ghazal
  const firstWork = await prisma.work.findUnique({
    where: { slug: 'meni-candan-usandirdi' },
  });

  const hasRuTranslation =
    firstWork &&
    (await prisma.translation.findFirst({ where: { workId: firstWork.id, language: 'RU' } }));

  if (firstWork && !hasRuTranslation) {
    await prisma.translation.create({
      data: {
        workId: firstWork.id,
        language: 'RU',
        type: 'TRANSLATION',
        body: `Меня от жизни отвратила, а мукам нет конца, не так ли?
Небесный свод горит от стонов, свеча мечты моей не гаснет?

Всем страждущим возлюбленная средство даст от горя,
Одна мне не даёт лекарства — неужто я не болен?

Скрывал я горе потаённо, сказали: «Расскажи любимой», —
Скажу — не верит мне, неверная, поверит ли, не знаю?

В ночь разлуки горит мой дух, а слёзы кровью льются,
Народ мой стон тревожит — а чёрная судьба проснётся ль?

Физули — вольнодумец страстный, миру вечно он позорен,
Спросите: что за страсть такая, неужто ей не надоест?`,
        bodyHtml: null,
        translator: 'Anonim',
        isDefault: true,
        status: 'PUBLISHED',
      },
    });
  }

  // Seed Nizami
  await prisma.author.upsert({
    where: { slug: 'nizami-gencevi' },
    update: {},
    create: {
      slug: 'nizami-gencevi',
      nameAz: 'Nizami Gəncəvi',
      nameRu: 'Низами Гянджеви',
      nameFa: 'نظامی گنجوی',
      nameEn: 'Nizami Ganjavi',
      bornYear: 1141,
      diedYear: 1209,
      type: 'POET',
      period: 'Klassik dövr',
      writingLangs: ['FA'],
      bioAz:
        'İlyas ibn Yusif Nizami Gəncəvi — XII əsrin böyük Azərbaycan şairi və mütəfəkkiri. "Xəmsə" adlı beş poemadan ibarət əsəri ilə dünya ədəbiyyatı tarixinə əbədi daxil olmuşdur.',
      status: 'PUBLISHED',
    },
  });

  // Seed Nasimi
  await prisma.author.upsert({
    where: { slug: 'nesimi' },
    update: {},
    create: {
      slug: 'nesimi',
      nameAz: 'İmadəddin Nəsimi',
      nameRu: 'Имадеддин Насими',
      nameFa: 'عمادالدین نسیمی',
      nameEn: 'Imadaddin Nasimi',
      bornYear: 1369,
      bornYearApprox: true,
      diedYear: 1417,
      type: 'POET',
      period: 'Klassik dövr',
      writingLangs: ['AZ_ARABIC', 'FA', 'AR'],
      bioAz:
        'İmadəddin Nəsimi — XIV–XV əsrlər Azərbaycan şairi, hürufi təriqətinin görkəmli nümayəndəsi. Azərbaycan dilində fəlsəfi lirika janrının banilərindəndir.',
      status: 'PUBLISHED',
    },
  });

  console.log('Seed complete: 3 authors, 1 collection, 2 works, 1 translation');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
