# Study Room

A Flask-based study hub with notes, flashcards, groups, and more.

## Run locally

1. Install dependencies:

```bash
python -m pip install -r requirements.txt
```

2. Start locally:

```bash
python app.py
```

3. Open:

```
http://127.0.0.1:5000
```

## Production deployment

This app includes a WSGI entrypoint and `waitress` for production serving.

### Run with Waitress

```bash
waitress-serve --listen=0.0.0.0:8000 wsgi:app
```

### Deploy to Render / Heroku / similar

- Set `web` command to:

```bash
waitress-serve --listen=0.0.0.0:$PORT wsgi:app
```

- Use environment variables:
  - `SECRET_KEY` for Flask secret key
  - `PORT` for the listen port
  - `FLASK_DEBUG=0` for production

### Notes

If hosting from a local machine, make sure your router/firewall forwards the desired port.
