'use client'

import Link from 'next/link'
import { useTranslation } from '@/lib/i18n/context'

export default function MentionsLegalesPage() {
  const { t } = useTranslation()
  const m = t.legal.mentions
  const l = t.legal

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 py-12">
        <Link href="/" className="text-sm text-ebios-600 hover:underline mb-6 inline-block">{l.back}</Link>

        <h1 className="text-3xl font-bold text-gray-900 mb-2">{m.title}</h1>
        <p className="text-sm text-gray-500 mb-8">{m.subtitle}</p>

        <div className="space-y-8 text-sm leading-relaxed text-gray-700">

          <section className="card p-6">
            <h2 className="text-base font-semibold text-gray-900 mb-4">{m.editor}</h2>
            <p className="text-gray-600 italic mb-3">
              Ces informations sont à compléter par l'organisation qui déploie et opère cette instance d'ACRA.
            </p>
            <div className="space-y-2">
              <div className="flex gap-2"><span className="font-medium w-40 flex-shrink-0">Raison sociale :</span><span className="text-gray-500">{m.toFill}</span></div>
              <div className="flex gap-2"><span className="font-medium w-40 flex-shrink-0">Forme juridique :</span><span className="text-gray-500">{m.toFill}</span></div>
              <div className="flex gap-2"><span className="font-medium w-40 flex-shrink-0">Siège social :</span><span className="text-gray-500">{m.toFill}</span></div>
              <div className="flex gap-2"><span className="font-medium w-40 flex-shrink-0">N° SIRET :</span><span className="text-gray-500">{m.toFill}</span></div>
              <div className="flex gap-2"><span className="font-medium w-40 flex-shrink-0">Capital social :</span><span className="text-gray-500">{m.toFill}</span></div>
              <div className="flex gap-2"><span className="font-medium w-40 flex-shrink-0">Email de contact :</span><span className="text-gray-500">{m.toFill}</span></div>
              <div className="flex gap-2"><span className="font-medium w-40 flex-shrink-0">Responsable de publication :</span><span className="text-gray-500">{m.toFill}</span></div>
            </div>
          </section>

          <section className="card p-6">
            <h2 className="text-base font-semibold text-gray-900 mb-4">{m.hosting}</h2>
            <p className="text-gray-600 italic mb-3">
              À compléter par l'organisation hébergeant l'application.
            </p>
            <div className="space-y-2">
              <div className="flex gap-2"><span className="font-medium w-40 flex-shrink-0">Hébergeur :</span><span className="text-gray-500">[{m.toFill} — ex. hébergement interne, OVH, AWS…]</span></div>
              <div className="flex gap-2"><span className="font-medium w-40 flex-shrink-0">Adresse :</span><span className="text-gray-500">{m.toFill}</span></div>
              <div className="flex gap-2"><span className="font-medium w-40 flex-shrink-0">Localisation :</span><span className="text-gray-500">[{m.toFill} — ex. France, UE]</span></div>
            </div>
          </section>

          <section className="card p-6">
            <h2 className="text-base font-semibold text-gray-900 mb-4">{m.ip}</h2>
            <p>
              L'application ACRA est un logiciel libre. Son code source est distribué sous licence open source.
              La méthode EBIOS Risk Manager est la propriété de l'ANSSI (Agence nationale de la sécurité des systèmes d'information).
              Son utilisation dans ACRA est réalisée à des fins pédagogiques et opérationnelles, conformément aux conditions d'utilisation de l'ANSSI.
            </p>
          </section>

          <section className="card p-6">
            <h2 className="text-base font-semibold text-gray-900 mb-4">{m.liability}</h2>
            <p>
              ACRA est un outil d'aide à la réalisation d'analyses de risques. Les résultats produits n'engagent pas
              la responsabilité de l'éditeur du logiciel. L'organisation utilisatrice est seule responsable de la
              qualité et de l'exactitude des analyses réalisées, ainsi que des décisions prises sur la base de ces analyses.
            </p>
            <p className="mt-3">
              L'éditeur ne saurait être tenu responsable des dommages directs ou indirects résultant de l'utilisation
              ou de l'impossibilité d'utiliser l'application.
            </p>
          </section>

          <section className="card p-6">
            <h2 className="text-base font-semibold text-gray-900 mb-4">{m.gdpr}</h2>
            <p>
              Le traitement des données personnelles est décrit dans notre{' '}
              <Link href="/legal/privacy" className="text-ebios-600 hover:underline">
                {t.legal.privacy.title}
              </Link>.
              Conformément au RGPD, vous disposez d'un droit d'accès, de rectification et de suppression de vos données.
            </p>
            <p className="mt-3">
              Pour exercer vos droits ou contacter le Délégué à la Protection des Données (DPO) :
              <span className="text-gray-500 ml-1">[Email DPO à compléter]</span>
            </p>
          </section>

          <section className="card p-6">
            <h2 className="text-base font-semibold text-gray-900 mb-4">{m.law}</h2>
            <p>
              Les présentes mentions légales sont soumises au droit français.
              En cas de litige, les tribunaux français seront seuls compétents.
            </p>
          </section>
        </div>

        <div className="mt-12 pt-6 border-t border-gray-200 flex gap-4 text-sm text-gray-500">
          <Link href="/legal/privacy" className="hover:text-ebios-600">{m.footerPrivacy}</Link>
          <Link href="/" className="hover:text-ebios-600">{l.backApp}</Link>
        </div>
      </div>
    </div>
  )
}
