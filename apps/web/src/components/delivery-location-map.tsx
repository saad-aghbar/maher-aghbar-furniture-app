'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  CircleMarker,
  MapContainer,
  Marker,
  TileLayer,
  ZoomControl,
  useMap,
  useMapEvents,
} from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useTranslations } from 'next-intl';

const DEFAULT_CENTER: [number, number] = [31.9539, 35.9106]; // Amman

const markerIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

type Props = {
  lat: number | null;
  lng: number | null;
  disabled?: boolean;
  onChange: (lat: number, lng: number) => void;
  /** Called on every pin change with full address + short place label for saving. */
  onAddressSuggest?: (address: string, placeLabel?: string) => void;
  hint?: string;
};

function MapClickHandler({
  disabled,
  onPick,
}: {
  disabled?: boolean;
  onPick: (lat: number, lng: number) => void;
}) {
  useMapEvents({
    click(e) {
      if (disabled) return;
      onPick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

function Recenter({
  position,
  userLocation,
  hasPin,
}: {
  position: [number, number] | null;
  userLocation: [number, number] | null;
  hasPin: boolean;
}) {
  const map = useMap();
  useEffect(() => {
    if (position) {
      map.setView(position, Math.max(map.getZoom(), 15));
      return;
    }
    if (userLocation && !hasPin) {
      map.setView(userLocation, 14);
    }
  }, [position, userLocation, hasPin, map]);
  return null;
}

export function DeliveryLocationMap({
  lat,
  lng,
  disabled,
  onChange,
  onAddressSuggest,
  hint,
}: Props) {
  const tc = useTranslations('catalog');
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [locating, setLocating] = useState(true);

  const position = useMemo<[number, number] | null>(() => {
    if (lat == null || lng == null || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return [lat, lng];
  }, [lat, lng]);

  const center = position ?? userLocation ?? DEFAULT_CENTER;

  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setLocating(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLocation([pos.coords.latitude, pos.coords.longitude]);
        setLocating(false);
      },
      () => setLocating(false),
      { enableHighAccuracy: true, timeout: 12_000, maximumAge: 60_000 },
    );
  }, []);

  useEffect(() => {
    if (!position || !onAddressSuggest) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      void (async () => {
        try {
          const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${position[0]}&lon=${position[1]}`;
          const res = await fetch(url, {
            signal: controller.signal,
            headers: { Accept: 'application/json' },
          });
          if (!res.ok) return;
          const data = (await res.json()) as {
            display_name?: string;
            name?: string;
            address?: Record<string, string | undefined>;
          };
          const full = data.display_name?.trim();
          if (!full) return;
          const a = data.address ?? {};
          const candidates = [
            data.name,
            a.road,
            a.neighbourhood || a.suburb || a.quarter || a.residential,
            a.city || a.town || a.village || a.municipality,
          ]
            .map((p) => (p ?? '').trim())
            .filter(Boolean);
          const unique = [...new Set(candidates)];
          const shortLabel =
            unique.slice(0, 2).join(', ') ||
            full
              .split(',')
              .map((p) => p.trim())
              .filter((p) => p && !/^\d+$/.test(p))
              .slice(0, 2)
              .join(', ');
          onAddressSuggest(full, shortLabel);
        } catch {
          /* ignore reverse-geocode failures */
        }
      })();
    }, 350);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [position, onAddressSuggest]);

  return (
    <div className="delivery-map space-y-2">
      {hint ? <p className="text-xs text-text-secondary">{hint}</p> : null}

      <div className="delivery-map__frame">
        <div className="delivery-map__chrome">
          <span className="delivery-map__chrome-dot" aria-hidden />
          <span className="delivery-map__chrome-label">
            {position ? tc('mapChromePinned') : tc('mapChromeIdle')}
          </span>
          {locating ? (
            <span className="delivery-map__chrome-status">{tc('mapFindingYou')}</span>
          ) : userLocation ? (
            <span className="delivery-map__chrome-status delivery-map__chrome-status--live">
              {tc('mapYourLocation')}
            </span>
          ) : null}
        </div>

        <div className="delivery-map__viewport">
          <MapContainer
            center={center}
            zoom={position || userLocation ? 14 : 11}
            className="delivery-map__leaflet"
            scrollWheelZoom={!disabled}
            dragging={!disabled}
            doubleClickZoom={!disabled}
            zoomControl={false}
            attributionControl
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <ZoomControl position="bottomright" />
            <MapClickHandler
              disabled={disabled}
              onPick={(nextLat, nextLng) => onChange(nextLat, nextLng)}
            />
            <Recenter position={position} userLocation={userLocation} hasPin={Boolean(position)} />
            {userLocation ? (
              <>
                <CircleMarker
                  center={userLocation}
                  radius={18}
                  pathOptions={{
                    color: '#3b82f6',
                    fillColor: '#3b82f6',
                    fillOpacity: 0.15,
                    weight: 1,
                  }}
                />
                <CircleMarker
                  center={userLocation}
                  radius={7}
                  pathOptions={{
                    color: '#ffffff',
                    fillColor: '#2563eb',
                    fillOpacity: 1,
                    weight: 2,
                  }}
                />
              </>
            ) : null}
            {position ? (
              <Marker
                position={position}
                icon={markerIcon}
                draggable={!disabled}
                eventHandlers={{
                  dragend: (e) => {
                    const m = e.target as L.Marker;
                    const p = m.getLatLng();
                    onChange(p.lat, p.lng);
                  },
                }}
              />
            ) : null}
          </MapContainer>
        </div>
      </div>

      {position ? (
        <p className="text-xs text-text-tertiary tabular-nums" dir="ltr">
          Pin {position[0].toFixed(5)}, {position[1].toFixed(5)}
        </p>
      ) : null}
    </div>
  );
}
