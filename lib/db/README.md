# PostgreSQL application adapter

The web application remains on `DATA_BACKEND=json` after installing this package.
Use `shadow` while comparing PostgreSQL reads with the existing JSON model, then
switch to `postgres` only after parity checks pass.

`client.ts` is server-only and uses one bounded pool per Node.js process. Never
import it from a Client Component and never expose `DATABASE_URL` through a
`NEXT_PUBLIC_` variable.
