import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { GoogleMap, Marker, useLoadScript } from '@react-google-maps/api';

const mapOptions = {
  disableDefaultUI: true,
  zoomControl: true,
  keyboardShortcuts: false,
  mapTypeControl: false
};

const renderFallback = (message) => (
  <div className="flex h-full w-full flex-col items-center justify-center rounded-xl bg-slate-900/30 text-center text-sm text-gray-300">
    <p>{message}</p>
  </div>
);

const LiveMap = ({
  title = 'Live Location',
  description,
  primaryLocation,
  primaryLabel = 'You',
  secondaryLocation,
  secondaryLabel = 'SOS',
  locationError,
  fallbackMessage = 'Waiting for location...'
}) => {
  const googleMapsApiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
  const { isLoaded, loadError } = useLoadScript({
    googleMapsApiKey,
    libraries: ['places']
  });

  const [center, setCenter] = useState(null);

  useEffect(() => {
    if (primaryLocation?.latitude && primaryLocation?.longitude) {
      setCenter({
        lat: primaryLocation.latitude,
        lng: primaryLocation.longitude
      });
      return;
    }
    if (secondaryLocation?.latitude && secondaryLocation?.longitude) {
      setCenter({
        lat: secondaryLocation.latitude,
        lng: secondaryLocation.longitude
      });
      return;
    }
    setCenter(null);
  }, [primaryLocation, secondaryLocation]);

  const activeMarkers = useMemo(() => {
    const markers = [];
    if (primaryLocation?.latitude && primaryLocation?.longitude) {
      markers.push({
        position: {
          lat: primaryLocation.latitude,
          lng: primaryLocation.longitude
        },
        label: primaryLabel
      });
    }
    if (secondaryLocation?.latitude && secondaryLocation?.longitude) {
      markers.push({
        position: {
          lat: secondaryLocation.latitude,
          lng: secondaryLocation.longitude
        },
        label: secondaryLabel
      });
    }
    return markers;
  }, [primaryLocation, secondaryLocation, primaryLabel, secondaryLabel]);

  const renderMap = () => {
    const locationErrorMessage = locationError === 'denied'
      ? 'Location access denied'
      : locationError;

    if (locationErrorMessage) {
      return renderFallback(locationErrorMessage);
    }

    if (loadError) {
      return renderFallback('Unable to load map');
    }

    if (!isLoaded) {
      return renderFallback('Loading Google Maps...');
    }

    if (!center) {
      return renderFallback(fallbackMessage);
    }

    return (
      <GoogleMap
        mapContainerClassName="h-full w-full rounded-2xl"
        center={center}
        zoom={15}
        options={mapOptions}
      >
        {activeMarkers.map((marker, index) => (
          <Marker key={`${marker.label}-${index}`} position={marker.position} label={marker.label} />
        ))}
      </GoogleMap>
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="w-full"
    >
      <div className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-2xl p-4 flex flex-col gap-4">
        <div>
          <h3 className="text-lg font-semibold text-white">{title}</h3>
          {description && <p className="text-sm text-gray-300">{description}</p>}
        </div>
        <div className="relative h-80 w-full overflow-hidden rounded-xl bg-slate-900/20 border border-white/10">
          {renderMap()}
        </div>
      </div>
    </motion.div>
  );
};

export default LiveMap;
