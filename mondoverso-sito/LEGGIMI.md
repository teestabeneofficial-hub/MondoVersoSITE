# MondoVERSO: il sito

Il sito mostra le offerte che pubblichi dal radar sul tuo computer. I dati stanno su Supabase:
il radar scrive (offerte, pagine città, racconti approvati), il sito legge e raccoglie
racconti, richieste di guida e iscrizioni agli avvisi, che poi gestisci dal radar.

## Da fare una volta sola

1. **Supabase**: apri il progetto, vai su *SQL Editor*, *New query*, incolla tutto il file
   `supabase/schema.sql` e premi *Run*.
2. **Diventa amministratore**: registrati sul sito (pagina *Profilo*) con la tua email,
   poi nel file `schema.sql` sostituisci `LA_TUA_EMAIL` con quella email e premi di nuovo *Run*
   (basta l'ultimo blocco).
3. **Email di accesso**: in Supabase, *Authentication*, *URL Configuration*, metti
   `https://www.mondoverso.com` come Site URL, così i link di accesso portano al sito.
4. **GitHub**: carica tutti i file di questa cartella nel repository, sostituendo quelli vecchi.
   Vercel pubblica da solo la nuova versione in un paio di minuti.
5. **Radar**: nella sezione *Sito* scrivi email e password del tuo profilo e premi *Collegati*.

## Pagine

- `/` offerte di oggi, Stasera si parte, Sorprendimi, città, racconti, avvisi
- `/citta/<nome>` pagina di ogni città, creata dal radar quando pubblichi
- `/guida` richiesta della guida del weekend
- `/racconta` racconti dei viaggiatori, con foto (si pubblicano dopo la tua approvazione)
- `/account` profilo: mappa delle città visitate e i propri racconti
- `/privacy`, `/cookie`, `/termini`, `/contatti` (da completare dove c'è [DATA] e [INDIRIZZO])

Le funzioni in `api/` della versione precedente restano disponibili ma la nuova pagina non le usa:
i prezzi sul sito sono solo quelli controllati dal radar.
