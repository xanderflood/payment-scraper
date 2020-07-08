payment-scraper
===============

Is a kernel of a privacy-centric budgeting tool. It uses a ProtonMail account consumes transaction notification emails, and updates a postgres table. The ProtonMail account is manipulated using [here](https://github.com/justinkalland/protonmail-api), although there seem to be rumors that ProtonMail will release an official API at some point). It then uses some pretty gnarly regular expressions to parse a handful of specific notifications from my bank. It's bound to be pretty brittle, but it's a work in progress.
