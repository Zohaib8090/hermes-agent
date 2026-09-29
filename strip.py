import os

files = [
    'apps/android/settings.gradle',
    'apps/android/build.gradle',
    'apps/android/app/build.gradle'
]

for f in files:
    if os.path.exists(f):
        data = open(f, 'rb').read()
        if data.startswith(b'\xef\xbb\xbf'):
            data = data[3:]
            open(f, 'wb').write(data)
            print(f"Stripped BOM from {f}")
        else:
            print(f"No BOM in {f}")
