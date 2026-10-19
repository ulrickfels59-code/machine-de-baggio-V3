import type { Metadata } from 'next';
import './globals.css';
export const metadata:Metadata={title:'Atelier Baggio | Parc machines',description:'Machines et documents techniques de l’atelier d’usinage Baggio.'};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="fr"><body>{children}</body></html>}
