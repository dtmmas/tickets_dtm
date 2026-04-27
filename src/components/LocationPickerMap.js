import React, { useEffect, useMemo, useState } from 'react';
import L from 'leaflet';
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow
});

const DEFAULT_CENTER = [15.5, -90.35];
const SEARCH_ENDPOINT = 'https://nominatim.openstreetmap.org/search';

const RecenterMap = ({ position }) => {
  const map = useMap();

  useEffect(() => {
    if (!position) return;
    map.flyTo(position, Math.max(map.getZoom(), 17), {
      animate: true,
      duration: 0.8
    });
  }, [map, position]);

  return null;
};

const ClickSelector = ({ disabled, onPick }) => {
  useMapEvents({
    click(event) {
      if (disabled) return;
      onPick(event.latlng);
    }
  });

  return null;
};

const LocationPickerMap = ({ latitud, longitud, onChange, disabled = false }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const hasCoordinates =
    latitud !== '' &&
    longitud !== '' &&
    Number.isFinite(Number(latitud)) &&
    Number.isFinite(Number(longitud));

  const position = useMemo(
    () => (hasCoordinates ? [Number(latitud), Number(longitud)] : null),
    [hasCoordinates, latitud, longitud]
  );

  const center = position || DEFAULT_CENTER;

  const handlePick = (latlng) => {
    onChange(latlng.lat.toFixed(7), latlng.lng.toFixed(7));
  };

  const handleSearch = async (event) => {
    event?.preventDefault?.();
    const query = searchQuery.trim();

    if (!query) {
      setSearchResults([]);
      setSearchError('Escriba una localidad, dirección o punto de referencia.');
      return;
    }

    try {
      setSearching(true);
      setSearchError('');
      const response = await fetch(
        `${SEARCH_ENDPOINT}?format=jsonv2&limit=6&accept-language=es&q=${encodeURIComponent(query)}`
      );

      if (!response.ok) {
        throw new Error('No se pudo consultar la ubicación');
      }

      const data = await response.json();
      if (!Array.isArray(data) || data.length === 0) {
        setSearchResults([]);
        setSearchError('No se encontraron coincidencias para esa búsqueda.');
        return;
      }

      setSearchResults(data);
    } catch (_) {
      setSearchResults([]);
      setSearchError('No fue posible buscar la ubicación en este momento.');
    } finally {
      setSearching(false);
    }
  };

  const handleSelectResult = (result) => {
    const nextLat = Number(result.lat).toFixed(7);
    const nextLng = Number(result.lon).toFixed(7);
    setSearchQuery(result.display_name || '');
    setSearchResults([]);
    setSearchError('');
    onChange(nextLat, nextLng);
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <div className="border-b border-slate-100 p-3">
        <form onSubmit={handleSearch} className="flex flex-col gap-2 sm:flex-row">
          <input
            type="text"
            value={searchQuery}
            onChange={(event) => {
              setSearchQuery(event.target.value);
              setSearchError('');
            }}
            disabled={disabled || searching}
            placeholder="Buscar localidad, colonia, calle o referencia"
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200 disabled:opacity-60"
          />
          <button
            type="submit"
            disabled={disabled || searching}
            className="rounded-xl bg-slate-800 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            {searching ? 'Buscando...' : 'Buscar'}
          </button>
        </form>
        {searchError && (
          <p className="mt-2 text-xs text-red-600">{searchError}</p>
        )}
        {searchResults.length > 0 && (
          <div className="mt-3 max-h-52 overflow-y-auto rounded-xl border border-slate-200">
            {searchResults.map((result) => (
              <button
                key={`${result.place_id}-${result.lat}-${result.lon}`}
                type="button"
                onClick={() => handleSelectResult(result)}
                className="block w-full border-b border-slate-100 px-3 py-2 text-left text-sm text-slate-700 transition last:border-b-0 hover:bg-slate-50"
              >
                {result.display_name}
              </button>
            ))}
          </div>
        )}
      </div>
      <MapContainer
        center={center}
        zoom={position ? 18 : 6}
        scrollWheelZoom
        className="h-72 w-full"
      >
        <TileLayer
          attribution='Tiles &copy; Esri'
          url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
        />
        <ClickSelector disabled={disabled} onPick={handlePick} />
        <RecenterMap position={position} />
        {position && (
          <Marker
            position={position}
            draggable={!disabled}
            eventHandlers={{
              dragend: (event) => {
                const nextPosition = event.target.getLatLng();
                handlePick(nextPosition);
              }
            }}
          />
        )}
      </MapContainer>
      <div className="border-t border-slate-100 px-3 py-2 text-xs text-slate-500">
        Busque una localidad, haga clic en el mapa o arrastre el marcador para definir la ubicación del cliente.
      </div>
    </div>
  );
};

export default LocationPickerMap;
