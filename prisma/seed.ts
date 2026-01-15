import { prisma } from '../lib/prisma';
import { hashPassword } from '../lib/auth';

const createTemplate = async (
  name: string,
  versionDate: string,
  sections: {
    name: string;
    items: {
      label: string;
      expectedQuantity: number;
      unit?: string | null;
      isElectronic?: boolean;
      isConsumable?: boolean;
    }[];
  }[]
) => {
  const template = await prisma.template.upsert({
    where: { name },
    update: { versionDate },
    create: { name, versionDate }
  });

  await prisma.templateSection.deleteMany({ where: { templateId: template.id } });

  for (const [sectionIndex, section] of sections.entries()) {
    const createdSection = await prisma.templateSection.create({
      data: {
        templateId: template.id,
        name: section.name,
        order: sectionIndex
      }
    });

    for (const [itemIndex, item] of section.items.entries()) {
      const isElectronic = item.isElectronic ?? false;
      const isConsumable = item.isConsumable ?? false;
      await prisma.templateItem.create({
        data: {
          sectionId: createdSection.id,
          label: item.label,
          expectedQuantity: item.expectedQuantity,
          unit: item.unit ?? null,
          requiresExpiryCheck: isConsumable,
          requiresFunctionalCheck: isElectronic,
          isElectronic,
          isConsumable,
          order: itemIndex
        }
      });
    }
  }
};

async function main() {
  const adminEmail = 'admin';
  const existingAdmin = await prisma.user.findUnique({ where: { email: adminEmail } });
  if (!existingAdmin) {
    const passwordHash = await hashPassword('admin');
    await prisma.user.create({
      data: {
        email: adminEmail,
        passwordHash,
        role: 'ADMIN',
        isActive: true,
        forcePasswordChange: true
      }
    });
  }

  await createTemplate('Sac armoire PS', '13/08/25', [
    {
      name: 'Poche',
      items: [
        { label: "2 crochets d’attache", expectedQuantity: 2 },
        { label: '1 fiche inventaire (A5)', expectedQuantity: 1 }
      ]
    },
    {
      name: 'Unidoses de sérum phy',
      items: [{ label: '50 unidoses de sérum phy', expectedQuantity: 50, isConsumable: true }]
    },
    {
      name: 'Compresses stériles',
      items: [
        {
          label: '50 compresses stériles 7,5x7,5cm',
          expectedQuantity: 50,
          isConsumable: true
        }
      ]
    },
    {
      name: 'Compresses non stériles',
      items: [{ label: '100 compresses non stériles', expectedQuantity: 100, isConsumable: true }]
    },
    {
      name: 'Bandes extensibles & filets tubulaires',
      items: [
        { label: '5 bandes extensibles 5cm', expectedQuantity: 5, isConsumable: true },
        { label: '5 bandes extensibles 10cm', expectedQuantity: 5, isConsumable: true },
        { label: '2 bandes extensibles 15cm', expectedQuantity: 2, isConsumable: true },
        { label: '1 filet tubulaire T2', expectedQuantity: 1, isConsumable: true },
        { label: '1 filet tubulaire T3', expectedQuantity: 1, isConsumable: true },
        { label: '1 filet tubulaire T4', expectedQuantity: 1, isConsumable: true }
      ]
    },
    {
      name: 'Pansements',
      items: [
        { label: '4 écharpes', expectedQuantity: 4, isConsumable: true },
        { label: '3 petites compresses brûlures', expectedQuantity: 3, isConsumable: true },
        { label: '3 moyennes compresses brûlures', expectedQuantity: 3, isConsumable: true },
        { label: '1 grande compresse brûlure', expectedQuantity: 1, isConsumable: true },
        { label: '1 rouleau de sparadrap 10cm', expectedQuantity: 1, isConsumable: true },
        { label: '3 rouleau de sparadrap', expectedQuantity: 3, isConsumable: true },
        { label: '2 pansements absorbants (2 tailles)', expectedQuantity: 2, isConsumable: true },
        { label: '1 lot de pansements', expectedQuantity: 1, isConsumable: true }
      ]
    },
    {
      name: 'Tensiomètre électrique',
      items: [{ label: '1 tensiomètre électrique', expectedQuantity: 1, isElectronic: true }]
    },
    {
      name: 'Bilan',
      items: [
        { label: '1 saturomètre', expectedQuantity: 1, isElectronic: true },
        { label: '1 thermomètre frontal', expectedQuantity: 1, isElectronic: true },
        { label: '1 glucomètre', expectedQuantity: 1, isElectronic: true },
        { label: '30 bandelettes', expectedQuantity: 30, isConsumable: true },
        { label: '10 auto-piqueurs', expectedQuantity: 10, isConsumable: true },
        { label: '1 unidose de sérum phy', expectedQuantity: 1, isConsumable: true },
        { label: '10 compresses 5x5cm', expectedQuantity: 10, isConsumable: true },
        { label: '1 lampe pupillère', expectedQuantity: 1, isElectronic: true },
        { label: '1 échelle visuel analogique (EVA)', expectedQuantity: 1 },
        { label: '1 paire de ciseaux bouts ronds', expectedQuantity: 1 },
        { label: '2 paire de ciseaux type “Jesco”', expectedQuantity: 2 },
        { label: '1 pince à écharde', expectedQuantity: 1 },
        { label: '1 tensiomètre manuel', expectedQuantity: 1 },
        { label: '3 brassards (baria-, adulte, pédia-)', expectedQuantity: 3 },
        { label: '1 stéthoscope', expectedQuantity: 1 }
      ]
    },
    {
      name: 'Poches de froid',
      items: [{ label: '12 poches de froid', expectedQuantity: 12, isConsumable: true }]
    },
    {
      name: 'Couvertures de survie',
      items: [{ label: '10 couvertures de survie', expectedQuantity: 10, isConsumable: true }]
    },
    {
      name: 'Resucrage',
      items: [
        { label: '5 gobelets', expectedQuantity: 5, isConsumable: true },
        { label: "1 bouteille d’eau 33cl", expectedQuantity: 1, isConsumable: true },
        { label: '15 sucres', expectedQuantity: 15, isConsumable: true }
      ]
    },
    {
      name: 'Étage 5',
      items: [
        { label: '2 paire de gants de manutentions', expectedQuantity: 2, isConsumable: true },
        { label: '10 vomix', expectedQuantity: 10, isConsumable: true },
        { label: '1 flacon de gel 100ml', expectedQuantity: 1, isConsumable: true }
      ]
    }
  ]);

  await createTemplate('Sac d’oxygénothérapie', '16/08/25', [
    {
      name: 'Poche principale',
      items: [
        {
          label: '1 Bouteille O² (vérifier pression restante)',
          expectedQuantity: 1,
          isElectronic: true
        }
      ]
    },
    {
      name: 'Poche avant intérieur',
      items: [
        { label: '1 fiche inventaire (A5)', expectedQuantity: 1 },
        { label: '1 kit AERV', expectedQuantity: 1, isConsumable: true },
        { label: "1 bouteille rince oeil", expectedQuantity: 1, isConsumable: true },
        { label: '1 solution Dakin', expectedQuantity: 1, isConsumable: true },
        { label: '1 petit savon', expectedQuantity: 1, isConsumable: true },
        { label: '2 paires de lunettes de protection', expectedQuantity: 2 },
        { label: '2 masques chirurgicaux', expectedQuantity: 2, isConsumable: true },
        { label: '2 paires de gants de manutention', expectedQuantity: 2, isConsumable: true }
      ]
    },
    {
      name: 'Poche latérale gauche',
      items: [
        { label: '1 insufflateur pédiatrique (et filtre)', expectedQuantity: 1, isElectronic: true },
        { label: '2 masques respiratoires', expectedQuantity: 2, isConsumable: true },
        { label: '2 MHC pédiatrique', expectedQuantity: 2, isConsumable: true },
        { label: '1 MMC pédiatrique', expectedQuantity: 1, isConsumable: true },
        { label: '1 paire de lunettes oxy pédiatrique', expectedQuantity: 1, isConsumable: true },
        { label: '1 aspirateur à mucosités manuel', expectedQuantity: 1 },
        { label: '1 sonde d’aspiration adulte', expectedQuantity: 1, isConsumable: true },
        { label: '1 sonde d’aspiration pédia', expectedQuantity: 1, isConsumable: true }
      ]
    },
    {
      name: 'Poche latérale droite',
      items: [
        { label: '1 insufflateur adulte (et filtre)', expectedQuantity: 1, isElectronic: true },
        { label: '2 masques respiratoires', expectedQuantity: 2, isConsumable: true },
        { label: '2 MHC adulte', expectedQuantity: 2, isConsumable: true },
        { label: '1 MMC adulte', expectedQuantity: 1, isConsumable: true },
        { label: '1 paire de lunettes oxy adulte', expectedQuantity: 1, isConsumable: true },
        { label: '1 boîte de canules de guedel', expectedQuantity: 1, isConsumable: true }
      ]
    },
    {
      name: 'Poche avant extérieure',
      items: [{ label: '1 DSA', expectedQuantity: 1, isElectronic: true }]
    }
  ]);

  await createTemplate('Sac Premiers Secours', '04/04/25', [
    {
      name: 'Poche avant',
      items: [
        { label: '1 fiche inventaire (A5)', expectedQuantity: 1 },
        { label: '1 pochette divers', expectedQuantity: 1 },
        { label: '1 rouleau de rubalise', expectedQuantity: 1, isConsumable: true },
        { label: '2 paires de gants de manutention', expectedQuantity: 2, isConsumable: true }
      ]
    },
    {
      name: 'Petite poche dos',
      items: [{ label: '1 sur-sac orange fluorescent', expectedQuantity: 1 }]
    },
    {
      name: 'Pochette divers (dans poche avant)',
      items: [
        { label: "1 petite bouteille d’eau (33cl)", expectedQuantity: 1, isConsumable: true },
        { label: '2 gobelets', expectedQuantity: 2, isConsumable: true },
        { label: '5 sucres', expectedQuantity: 5, isConsumable: true },
        { label: '2 couvertures de survie', expectedQuantity: 2, isConsumable: true },
        { label: '2 vomix', expectedQuantity: 2, isConsumable: true }
      ]
    },
    {
      name: 'Bilan',
      items: [
        { label: '1 saturomètre', expectedQuantity: 1, isElectronic: true },
        { label: '1 tensiomètre électrique', expectedQuantity: 1, isElectronic: true },
        { label: '1 thermomètre frontal', expectedQuantity: 1, isElectronic: true },
        { label: '1 glucomètre', expectedQuantity: 1, isElectronic: true },
        { label: '30 bandelettes', expectedQuantity: 30, isConsumable: true },
        { label: '10 auto-piqueurs', expectedQuantity: 10, isConsumable: true },
        { label: '1 lampe pupillère', expectedQuantity: 1, isElectronic: true },
        { label: '1 paire de ciseaux bouts ronds', expectedQuantity: 1 },
        { label: '1 paire de ciseaux type “Jesco”', expectedQuantity: 1 },
        { label: '1 pince à écharde', expectedQuantity: 1 }
      ]
    },
    {
      name: 'Circulatoire',
      items: [
        { label: '5 compresses stériles 7.5x7.5cm', expectedQuantity: 5, isConsumable: true },
        { label: '10 unidoses de sérum phy', expectedQuantity: 10, isConsumable: true },
        { label: '1 sachet de pansements', expectedQuantity: 1, isConsumable: true },
        { label: '1 rouleau de sparadrap', expectedQuantity: 1, isConsumable: true },
        { label: '1 CHU', expectedQuantity: 1 },
        { label: '2 garrots tourniquets', expectedQuantity: 2 },
        { label: '2 pansements absorbants', expectedQuantity: 2, isConsumable: true }
      ]
    },
    {
      name: 'Traumatologie',
      items: [
        { label: '2 poches de froid', expectedQuantity: 2, isConsumable: true },
        { label: '2 echarpes', expectedQuantity: 2, isConsumable: true },
        { label: '2 bandes extensibles 5x300cm', expectedQuantity: 2, isConsumable: true },
        { label: '1 bandes extensibles 10x400cm', expectedQuantity: 1, isConsumable: true },
        { label: '1 bande extensible 15x400cm', expectedQuantity: 1, isConsumable: true }
      ]
    },
    {
      name: 'Respiratoire',
      items: [
        { label: '1 insufflateur adulte (et filtre)', expectedQuantity: 1, isElectronic: true },
        { label: '2 masques respiratoires', expectedQuantity: 2, isConsumable: true },
        { label: '1 insufflateur pédiatrique (et filtre)', expectedQuantity: 1, isElectronic: true },
        { label: '2 masques respiratoires', expectedQuantity: 2, isConsumable: true },
        { label: '4 canules de guedel (2, 3, 4 et 5)', expectedQuantity: 4, isConsumable: true }
      ]
    },
    {
      name: 'Colliers cervicaux',
      items: [
        { label: '4 colliers cervicaux (4 tailles différentes)', expectedQuantity: 4, isConsumable: true }
      ]
    },
    {
      name: 'Poche interne',
      items: [
        { label: '2 paires de lunettes', expectedQuantity: 2 },
        { label: '2 masques chirurgicaux', expectedQuantity: 2, isConsumable: true },
        { label: '2 masques FFP2', expectedQuantity: 2, isConsumable: true },
        { label: '4 paires de gants (XL)', expectedQuantity: 4, isConsumable: true },
        { label: '1 flacon de gel 200ml', expectedQuantity: 1, isConsumable: true },
        { label: '1 sac DASRI', expectedQuantity: 1, isConsumable: true },
        { label: '1 sac DAOM', expectedQuantity: 1, isConsumable: true }
      ]
    }
  ]);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
