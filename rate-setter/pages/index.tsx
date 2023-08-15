import Head from "next/head";

import styles from "../styles/Home.module.css";

import Charts from "../components/Charts";

export default function Home() {
  return (
    <div className={styles.container}>
      <Charts />

      <Head>
        <title>🦗 Rate Update</title>
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <main>
        <h1 className={styles.title}>🦗 Rate Update</h1>

        <p className={styles.description}>
          Update GEB rate using <code>updateRate()</code>
        </p>

        <p className={styles.description}>
          Trigger the bot: <code>{`/api/rate?key=<some-secret>`}</code>
        </p>

        <div className={styles.grid}>
          <a href="https://docs.opendollar.com" className={styles.description}>
            <h3>📖 Docs</h3>
          </a>
        </div>
      </main>

      <footer>
        <a
          href="https://OpenDollar.com"
          target="_blank"
          rel="noopener noreferrer"
        >
          Powered by Open Dollar
        </a>
      </footer>

      <style jsx>{`
        main {
          padding: 5rem 0;
          flex: 1;
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
        }
        footer {
          width: 100%;
          height: 100px;
          border-top: 1px solid #eaeaea;
          display: flex;
          justify-content: center;
          align-items: center;
        }
        footer img {
          margin-left: 0.5rem;
        }
        footer a {
          display: flex;
          justify-content: center;
          align-items: center;
          text-decoration: none;
          color: inherit;
        }
        code {
          background: #fafafa;
          border-radius: 5px;
          padding: 0.75rem;
          font-size: 1.1rem;
          font-family: Menlo, Monaco, Lucida Console, Liberation Mono,
            DejaVu Sans Mono, Bitstream Vera Sans Mono, Courier New, monospace;
        }
      `}</style>

      <style jsx global>{`
        html,
        body {
          padding: 0;
          margin: 0;
          font-family: -apple-system, BlinkMacSystemFont, Segoe UI, Roboto,
            Oxygen, Ubuntu, Cantarell, Fira Sans, Droid Sans, Helvetica Neue,
            sans-serif;
        }
        * {
          box-sizing: border-box;
        }
      `}</style>
    </div>
  );
}