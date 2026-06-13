'use client'

import Link from 'next/link'
import { useTranslation } from '@/lib/i18n/context'

export default function PrivacyPage() {
  const { t } = useTranslation()
  const p = t.legal.privacy
  const l = t.legal

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 py-12">
        <Link href="/" className="text-sm text-ebios-600 hover:underline mb-6 inline-block">{l.back}</Link>

        <h1 className="text-3xl font-bold text-gray-900 mb-2">{p.title}</h1>
        <p className="text-sm text-gray-500 mb-8">{p.subtitle}</p>

        <div className="prose prose-gray max-w-none space-y-8 text-sm leading-relaxed text-gray-700">

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">{p.s1}</h2>
            <p>
              ACRA (Augmented Cyber Risk Analysis) est un outil interne de gestion des risques cyber.
              Le responsable du traitement est l'organisation qui déploie et opère cette instance de l'application.
              Pour toute question relative à la protection des données, contactez votre Délégué à la Protection des Données (DPO)
              ou l'administrateur de l'application.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">{p.s2}</h2>
            <p>Dans le cadre de l'utilisation d'ACRA, les données suivantes peuvent être collectées :</p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li><strong>Données d'identification :</strong> nom, adresse e-mail, rôle dans l'organisation.</li>
              <li><strong>Données d'authentification :</strong> hash du mot de passe (jamais le mot de passe en clair), date de dernière modification.</li>
              <li><strong>Données d'analyse de risques :</strong> informations relatives aux analyses EBIOS RM créées par l'utilisateur (organisations, scénarios, risques, mesures).</li>
              <li><strong>Données de journalisation :</strong> actions techniques (connexion, modifications) à des fins de traçabilité et de sécurité.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">{p.s3}</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse border border-gray-200 rounded-lg">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="text-left p-3 border border-gray-200">{p.colPurpose}</th>
                    <th className="text-left p-3 border border-gray-200">{p.colLegal}</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ['Authentification et gestion des comptes utilisateurs', 'Exécution du contrat (Art. 6.1.b)'],
                    ['Réalisation et stockage des analyses de risques', 'Intérêt légitime (Art. 6.1.f) — sécurité des systèmes'],
                    ['Gestion des rôles et des droits d\'accès (RBAC)', 'Obligation légale et intérêt légitime (Art. 6.1.c/f)'],
                    ['Journalisation pour la sécurité et la traçabilité', 'Intérêt légitime (Art. 6.1.f)'],
                  ].map(([f, b], i) => (
                    <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="p-3 border border-gray-200">{f}</td>
                      <td className="p-3 border border-gray-200">{b}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">{p.s4}</h2>
            <p>
              Les données sont accessibles aux utilisateurs authentifiés selon leurs droits (RBAC).
              Elles ne sont pas transmises à des tiers sans consentement explicite, sauf obligation légale.
              Les données d'analyses peuvent être partagées entre membres d'une même équipe selon les permissions configurées par le propriétaire de l'analyse.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">{p.s5}</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Comptes utilisateurs :</strong> conservés tant que le compte est actif. Supprimables par l'administrateur.</li>
              <li><strong>Analyses de risques :</strong> conservées jusqu'à suppression explicite par le propriétaire ou l'administrateur.</li>
              <li><strong>Journaux de connexion :</strong> durée déterminée par la politique de journalisation de l'organisation (recommandé : 12 mois).</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">{p.s6}</h2>
            <p>Conformément au RGPD, vous disposez des droits suivants :</p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li><strong>Droit d'accès</strong> (Art. 15) — obtenir une copie de vos données personnelles.</li>
              <li><strong>Droit de rectification</strong> (Art. 16) — corriger des données inexactes.</li>
              <li><strong>Droit à l'effacement</strong> (Art. 17) — demander la suppression de votre compte et données.</li>
              <li><strong>Droit à la portabilité</strong> (Art. 20) — exporter vos analyses via la fonction d'export JSON/CSV.</li>
              <li><strong>Droit d'opposition</strong> (Art. 21) — vous opposer à certains traitements fondés sur l'intérêt légitime.</li>
              <li><strong>Droit de limitation</strong> (Art. 18) — demander la limitation du traitement.</li>
            </ul>
            <p className="mt-3">
              Pour exercer ces droits, contactez votre DPO ou l'administrateur de l'instance ACRA.
              En cas de réponse insatisfaisante, vous pouvez introduire une réclamation auprès de la{' '}
              <a href="https://www.cnil.fr" className="text-ebios-600 hover:underline" target="_blank" rel="noopener noreferrer">CNIL</a>.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">{p.s7}</h2>
            <p>
              ACRA met en œuvre les mesures de sécurité suivantes : chiffrement des mots de passe (bcrypt),
              authentification par jeton JWT, contrôle d'accès basé sur les rôles (RBAC), en-têtes de sécurité HTTP
              (CSP, HSTS, X-Frame-Options), validation stricte des entrées (Zod), et limitation du nombre de tentatives de connexion.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">{p.s8}</h2>
            <p>
              ACRA utilise uniquement des cookies strictement nécessaires au fonctionnement :
              un cookie de session pour l'authentification (JWT NextAuth) et un cookie de préférence de langue
              (<code className="bg-gray-100 px-1 rounded">acra-locale</code>). Aucun cookie de tracking ou publicitaire n'est utilisé.
            </p>
          </section>
        </div>

        <div className="mt-12 pt-6 border-t border-gray-200 flex gap-4 text-sm text-gray-500">
          <Link href="/legal/mentions" className="hover:text-ebios-600">{p.footerMentions}</Link>
          <Link href="/" className="hover:text-ebios-600">{l.backApp}</Link>
        </div>
      </div>
    </div>
  )
}
