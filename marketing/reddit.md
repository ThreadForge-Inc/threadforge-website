# Reddit — ThreadForge 10.17

**Where:** r/smallbusiness, r/supplychain, r/procurement, r/selfhosted (each has its own self-promotion rules:
read them first, post where a discussion is welcome, and answer every comment).

**Title:** I build a local-first business workspace (stock, orders, trade sourcing, supplier checks). What would make you trust a tool like this?

**Body:**
I'm the founder of ThreadForge. It keeps stock, orders, trade sourcing calculations, supplier due diligence and
projects in one workspace that runs on your own PC, phone or server. The records stay on your device; there is
no sign-up and no telemetry.

Version 10.17 changed how it is sold, and I'd like honest views on it:
- a 14-day Essentials trial, after which it only reads until you buy (nothing is locked or deleted);
- one-time prices from $49, or single desks from $34 with an upgrade costing only the difference;
- every download checked against the build that made it (543 backend tests and 52 native Windows checks for 10.17.2).

What is not done yet: the Windows installer from the website is not publisher-signed, so SmartScreen may warn
(the Microsoft Store edition is signed by Microsoft), and it is not on Google Play yet.

There's a 60-minute live demo on sample data if you'd rather poke at it than read about it:
https://threadforgeofficial.com

Happy to answer questions about the architecture: a Flask service on 127.0.0.1, SQLite, Python 3.13 embedded
in the Android app, and optional local models through Ollama.
