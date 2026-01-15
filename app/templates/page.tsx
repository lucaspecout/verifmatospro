import { prisma } from '@/lib/prisma';

export default async function TemplatesPage() {
  const templates = await prisma.template.findMany({
    include: { sections: { include: { items: true } } },
    orderBy: { createdAt: 'desc' }
  });

  return (
    <div className="grid gap-6">
      <section className="card">
        <h1 className="text-2xl font-bold">Templates de checklist</h1>
        <p className="mt-2 text-sm text-slate-600">
          Modèles standardisés pour générer les checklists d’événements.
        </p>
      </section>
      <div className="grid gap-4">
        {templates.map((template) => (
          <div key={template.id} className="card">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">{template.name}</h2>
                <p className="text-sm text-slate-600">Version {template.versionDate}</p>
              </div>
              <span className="text-sm text-slate-500">
                {template.sections.reduce((count, section) => count + section.items.length, 0)} items
              </span>
            </div>
            <div className="mt-4 grid gap-2 text-sm text-slate-600">
              {template.sections.map((section) => (
                <div key={section.id}>
                  <strong>{section.name}</strong> ({section.items.length})
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
