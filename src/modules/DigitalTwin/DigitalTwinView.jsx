import React, { useRef, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Grid, Text, Environment } from '@react-three/drei';
import { useTagStore } from '../../stores/index';
import { RotateCcw, Tag, Activity } from 'lucide-react';
import './DigitalTwin.css';

function ConveyorBelt({ position, length = 4, running = true, label = '' }) {
  const ref = useRef();
  useFrame((_, delta) => { if (running && ref.current) ref.current.rotation.z -= delta * 2; });
  return (
    <group position={position}>
      <mesh><boxGeometry args={[length, 0.2, 1]} /><meshStandardMaterial color={running ? '#10b981' : '#64748b'} metalness={0.6} roughness={0.3} /></mesh>
      {Array.from({ length: Math.floor(length / 0.5) }, (_, i) => (
        <mesh key={i} position={[-length/2 + 0.25 + i * 0.5, 0.15, 0]} ref={i === 0 ? ref : undefined}>
          <cylinderGeometry args={[0.08, 0.08, 1, 8]} rotation={[Math.PI/2, 0, 0]} />
          <meshStandardMaterial color="#334155" metalness={0.8} />
        </mesh>
      ))}
      <Text position={[0, 0.6, 0]} fontSize={0.25} color="#94a3b8" anchorX="center">{label}</Text>
    </group>
  );
}

function Machine({ position, running = true, label = '' }) {
  const lightRef = useRef();
  useFrame((_, delta) => { if (lightRef.current) lightRef.current.intensity = running ? 1 + Math.sin(Date.now() * 0.005) * 0.3 : 0.1; });
  return (
    <group position={position}>
      <mesh><boxGeometry args={[1.5, 2, 1.5]} /><meshStandardMaterial color={running ? '#1e293b' : '#0f172a'} metalness={0.7} roughness={0.2} /></mesh>
      <mesh position={[0, 1.05, 0]}><boxGeometry args={[1.6, 0.1, 1.6]} /><meshStandardMaterial color={running ? '#3b82f6' : '#ef4444'} emissive={running ? '#3b82f6' : '#ef4444'} emissiveIntensity={0.5} /></mesh>
      <pointLight ref={lightRef} position={[0, 1.5, 0]} color={running ? '#3b82f6' : '#ef4444'} distance={4} />
      <Text position={[0, 2.3, 0]} fontSize={0.25} color="#f1f5f9" anchorX="center">{label}</Text>
    </group>
  );
}

function SensorPoint({ position, value = 0, label = '' }) {
  const color = value > 90 ? '#ef4444' : value > 70 ? '#f59e0b' : '#10b981';
  return (
    <group position={position}>
      <mesh><sphereGeometry args={[0.15, 16, 16]} /><meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.8} /></mesh>
      <Text position={[0, 0.4, 0]} fontSize={0.18} color={color} anchorX="center">{value.toFixed(1)}</Text>
      <Text position={[0, 0.65, 0]} fontSize={0.14} color="#64748b" anchorX="center">{label}</Text>
    </group>
  );
}

function FactoryScene() {
  const tags = useTagStore((s) => s.tags);
  const connected = useTagStore((s) => s.connected);

  const sensorValues = useMemo(() => {
    if (connected && tags.length > 0) {
      return tags.filter(t => t.type === 'Float').slice(0, 4).map(t => ({ name: t.name, value: typeof t.value === 'number' ? t.value : 0 }));
    }
    return [{ name: 'Temp-1', value: 72 + Math.random()*10 }, { name: 'Pression', value: 45 + Math.random()*20 }, { name: 'Débit', value: 60 + Math.random()*15 }, { name: 'Niveau', value: 50 + Math.random()*30 }];
  }, [tags, connected]);

  return (
    <>
      <ambientLight intensity={0.3} />
      <directionalLight position={[10, 15, 10]} intensity={0.8} castShadow />
      <Grid infiniteGrid fadeDistance={30} cellColor="#1e293b" sectionColor="#334155" />
      <ConveyorBelt position={[-3, 0.1, 0]} length={5} running={true} label="Conv-01" />
      <ConveyorBelt position={[3, 0.1, 0]} length={5} running={true} label="Conv-02" />
      <ConveyorBelt position={[0, 0.1, 3]} length={4} running={false} label="Conv-03" />
      <Machine position={[-1, 1, -2]} running={true} label="Machine M1" />
      <Machine position={[2, 1, -2]} running={true} label="Machine M2" />
      <Machine position={[5, 1, -2]} running={false} label="Broyeur BR2" />
      {sensorValues.map((s, i) => (
        <SensorPoint key={i} position={[-4 + i * 2.5, 1.5, 2]} value={s.value} label={s.name} />
      ))}
      <OrbitControls enableDamping dampingFactor={0.05} maxPolarAngle={Math.PI / 2.2} minDistance={5} maxDistance={25} />
    </>
  );
}

export default function DigitalTwinView() {
  const { t } = useTranslation();
  const tags = useTagStore((s) => s.tags);
  const connected = useTagStore((s) => s.connected);

  return (
    <div className="digital-twin fade-in">
      <div className="page-header flex-between">
        <div><h1>{t('digitalTwin.title')}</h1><p>{t('digitalTwin.subtitle')}</p></div>
        <div className="flex-gap">
          {connected && <span className="status-badge running"><span className="dot" />{t('common.live')}</span>}
          <button className="btn btn-secondary btn-sm"><RotateCcw size={14} />{t('digitalTwin.resetView')}</button>
        </div>
      </div>

      <div className="dt-layout">
        <div className="dt-canvas-wrapper">
          <Canvas camera={{ position: [8, 8, 8], fov: 50 }} shadows>
            <FactoryScene />
          </Canvas>
        </div>

        <div className="dt-sidebar">
          <div className="glass-card">
            <h4 className="section-title"><Activity size={16} style={{ marginRight: 6 }} />{t('digitalTwin.equipmentStatus')}</h4>
            <div className="equip-list">
              <div className="equip-item"><span className="status-badge running"><span className="dot" />Running</span><span>Machine M1</span></div>
              <div className="equip-item"><span className="status-badge running"><span className="dot" />Running</span><span>Machine M2</span></div>
              <div className="equip-item"><span className="status-badge error"><span className="dot" />Stopped</span><span>Broyeur BR2</span></div>
              <div className="equip-item"><span className="status-badge running"><span className="dot" />Running</span><span>Conv-01</span></div>
              <div className="equip-item"><span className="status-badge running"><span className="dot" />Running</span><span>Conv-02</span></div>
              <div className="equip-item"><span className="status-badge stopped"><span className="dot" />Off</span><span>Conv-03</span></div>
            </div>
          </div>

          {connected && tags.length > 0 && (
            <div className="glass-card">
              <h4 className="section-title"><Tag size={16} style={{ marginRight: 6 }} />{t('digitalTwin.liveOverlay')}</h4>
              <div className="live-tags">
                {tags.slice(0, 8).map(tag => (
                  <div key={tag.id} className="live-tag-row">
                    <span className="tag-name">{tag.name}</span>
                    <span className={`data-value ${tag.type === 'Float' ? 'value-float' : ''}`} style={{ fontSize: '0.85rem' }}>
                      {typeof tag.value === 'boolean' ? (tag.value ? 'ON' : 'OFF') : typeof tag.value === 'number' ? tag.value.toFixed(2) : String(tag.value)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
