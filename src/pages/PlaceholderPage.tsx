import { PageHeader, PageContent } from '@/components/layout/PageHeader'
import { Card, CardBody } from '@/components/ui/Card'

interface Props {
  title: string
  description: string
}

export function PlaceholderPage({ title, description }: Props) {
  return (
    <>
      <PageHeader title={title} subtitle={description} />
      <PageContent>
        <Card>
          <CardBody className="py-12 text-center">
            <p className="text-sm text-[var(--color-fg-muted)]">
              Cette page sera construite lors de la prochaine itération.
            </p>
            <p className="mt-2 text-xs text-[var(--color-fg-subtle)]">
              Le backend expose déjà l'API associée — il reste à brancher l'UI.
            </p>
          </CardBody>
        </Card>
      </PageContent>
    </>
  )
}
