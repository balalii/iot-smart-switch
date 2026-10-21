# Simpan / baca file JSON di flash ESP32.
import json


def load(name, default):
    try:
        with open(name) as f:
            return json.load(f)
    except (OSError, ValueError):
        return default


def save(name, data):
    try:
        with open(name, "w") as f:
            json.dump(data, f)
        return True
    except OSError as e:
        print("Gagal menyimpan", name, e)
        return False


def remove(name):
    try:
        import os

        os.remove(name)
    except OSError:
        pass
