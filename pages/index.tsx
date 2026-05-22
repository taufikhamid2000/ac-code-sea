import Head from "next/head";
import { Cormorant_Garamond } from "next/font/google";
import Game from "@/components/game/Game";

const display = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export default function Home() {
  return (
    <>
      <Head>
        <title>AC · Code SEA — The Temptation of the Keris</title>
        <meta
          name="description"
          content="A browser-playable interactive narrative. The Brotherhood, in pre-colonial Southeast Asia. Make a choice. See what happens."
        />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <meta name="theme-color" content="#000000" />
        <meta property="og:title" content="AC · Code SEA" />
        <meta
          property="og:description"
          content="The Brotherhood, in pre-colonial Southeast Asia. A choose-your-path story."
        />
        <meta property="og:type" content="website" />
        <meta property="og:image" content="/9.png" />
      </Head>
      <div className={display.className}>
        <Game />
      </div>
    </>
  );
}
