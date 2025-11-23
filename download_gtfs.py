import requests
import zipfile
import io
import os

ZIP_URL = "https://ssl.renfe.com/ftransit/Fichero_CER_FOMENTO/fomento_transit.zip"
TARGET_DIR = "gtfs"

def download_and_extract_gtfs():
    if not os.path.exists(TARGET_DIR):
        os.makedirs(TARGET_DIR)
        
    print(f"Descargando ZIP de {ZIP_URL}...")
    response = requests.get(ZIP_URL)
    
    if response.status_code == 200:
        z = zipfile.ZipFile(io.BytesIO(response.content))
        z.extractall(TARGET_DIR)
        print(f"Archivos GTFS extraídos correctamente en /{TARGET_DIR}")
    else:
        print(f"Error al descargar: Código de estado {response.status_code}")

if __name__ == "__main__":
    download_and_extract_gtfs()