import React, { useImperativeHandle, useRef } from 'react';
import { View } from 'react-native';
import { Camera, Map, Marker, UserLocation, type CameraRef } from '@maplibre/maplibre-react-native';
import { StandPin } from '@/components/StandPin';
import { useTheme } from '@/theme/ThemeProvider';
import { MAP_STYLES, MAP_ZOOM, type StandMapProps } from './mapTypes';

// The stand map on Android and iOS (04 R09).
export function StandMap({
  stands,
  center,
  selectedId,
  onSelect,
  showUser,
  interactive = true,
  height,
  radius = 22,
  ref,
}: StandMapProps) {
  const { mode } = useTheme();
  const camera = useRef<CameraRef>(null);

  useImperativeHandle(ref, () => ({
    recenter: (to) => {
      void camera.current?.easeTo({ center: [to.lng, to.lat], zoom: MAP_ZOOM, duration: 500 });
    },
  }));

  return (
    <View style={{ flex: height ? undefined : 1, height, borderRadius: radius, overflow: 'hidden' }}>
      <Map
        testID="stand-map"
        style={{ flex: 1 }}
        mapStyle={MAP_STYLES[mode]}
        logo={false}
        compass={false}
        dragPan={interactive}
        touchZoom={interactive}
        doubleTapZoom={interactive}
        touchRotate={false}
        touchPitch={false}
        onPress={interactive && onSelect ? () => onSelect(null) : undefined}
      >
        <Camera ref={camera} initialViewState={{ center: [center.lng, center.lat], zoom: MAP_ZOOM }} />
        {showUser ? <UserLocation /> : null}
        {stands.map((s) => (
          <Marker
            key={s.id}
            id={s.id}
            lngLat={[s.lng, s.lat]}
            onPress={onSelect ? () => onSelect(s.id) : undefined}
          >
            <View
              accessible
              accessibilityRole="button"
              accessibilityLabel={s.name}
              testID={`stand-pin.${s.name}`}
            >
              <StandPin free={s.free_bikes} name={s.name} selected={s.id === selectedId} />
            </View>
          </Marker>
        ))}
      </Map>
    </View>
  );
}
