import { useState } from 'react'
import { PageHeader, PageContent } from '@/components/layout/PageHeader'
import { Card, CardBody } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'

type Variant = 'full' | 'empty' | 'error'

const VARIANTS: { key: Variant; label: string; desc: string }[] = [
  { key: 'full',  label: 'Complet', desc: '3 opportunités + snapshot + alertes' },
  { key: 'empty', label: 'Sans signal', desc: "Jour calme — honnêteté de l'analyste" },
  { key: 'error', label: 'Dégradé', desc: 'Synthèse LLM échouée' },
]

export function PreviewPage() {
  const [variant, setVariant] = useState<Variant>('full')
  const src = `/preview/brief?variant=${variant}`

  return (
    <>
      <PageHeader
        title="Aperçu email"
        subtitle="Vérifie la charte graphique avant envoi (aucun email n'est envoyé)."
        actions={
          <Button variant="outline" size="sm" onClick={() => window.open(src, '_blank')}>
            Ouvrir dans un nouvel onglet ↗
          </Button>
        }
      />
      <PageContent>
        <div className="flex flex-wrap gap-2">
          {VARIANTS.map((v) => (
            <Button
              key={v.key}
              variant={variant === v.key ? 'primary' : 'outline'}
              size="sm"
              onClick={() => setVariant(v.key)}
            >
              {v.label}
              <span className="ml-2 text-[10px] opacity-75">{v.desc}</span>
            </Button>
          ))}
        </div>
        <Card>
          <CardBody className="p-0">
            <iframe
              title={`Preview ${variant}`}
              src={src}
              className="w-full bg-white rounded-lg"
              style={{ height: '80vh', border: 0 }}
            />
          </CardBody>
        </Card>
      </PageContent>
    </>
  )
}
