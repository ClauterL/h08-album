# H08T03 – Julkaisu pilveen (esimerkki: Render)

Tämä dokumentti täyttää [H08 Backend-testaus, julkaisu – H08T03](https://matskut.pages.labranet.jamk.fi/tt00cd85-k2026/exrc/ex08/) ‑kohdan dokumentointivaatimuksen.

## 1. Valmistelu

- MongoDB Atlas ‑klusteri ja `MONGO_URI` (Network Access: salli Renderin ulostulo-IP:t tai `0.0.0.0/0` kehitysvaiheessa).
- Repossa `H08/server.js` käynnistää tuotantopalvelimen; `H08/app.js` on testejä varten erillinen Express-app.

## 2. Render (tai vastaava PaaS)

1. Luo **New → Web Service** ja yhdistä GitHub/GitLab ‑repo (ei suositella pelkkä Vercel paikallisesta GitLabista – käytä esim. Renderiä tai Railwayta, kuten tehtävänanto).
2. **Root directory**: `H08` (tai aseta build/start juureen, jossa `package.json` on).
3. **Build command**: `npm install`
4. **Start command**: `node server.js`
5. **Environment**: lisää `MONGO_URI` (ja tarvittaessa `PORT`).

## 3. Tietokanta

- Atlasissa sama kokoelma kuin paikallisesti; julkaisussa käytä erillistä tietokantaa tai kokoelmaa, jos haluat erottaa dev/test/prod.

## 4. Tarkistus

- `GET https://<palvelu>/api/albums` palauttaa JSON-listan.
- `npm test` ajetaan paikallisesti ennen pushia (H08T01–T02).

## 5. Sinun tehtäväsi

- Luo Render (tai muu) ‑tili ja liitä **oma** reposi; kopioi valmis **julkinen URL** tähän tiedostoon tai `README.md`:hen, kun palvelu on päällä.
