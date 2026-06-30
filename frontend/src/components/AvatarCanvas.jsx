import { useState, useEffect, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { VRMLoaderPlugin } from '@pixiv/three-vrm'

function GlbModel({ url, isSpeaking }) {
  const [scene, setScene] = useState(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let disposed = false
    let loadedScene = null
    setScene(null)
    setFailed(false)

    const loader = new GLTFLoader()
    loader.load(
      url,
      (gltf) => {
        loadedScene = gltf.scene
        if (disposed) {
          disposeScene(loadedScene)
        } else {
          setScene(loadedScene)
        }
      },
      undefined,
      (error) => {
        console.error('Error loading GLB:', error)
        if (!disposed) setFailed(true)
      }
    )

    return () => {
      disposed = true
      if (loadedScene) disposeScene(loadedScene)
    }
  }, [url])

  useFrame((state) => {
    if (!scene) return
    const t = state.clock.getElapsedTime()
    const spine = scene.getObjectByName('Spine')
    const neck = scene.getObjectByName('Neck')
    const head = scene.getObjectByName('Head')
    const leftArm = scene.getObjectByName('LeftArm')
    const rightArm = scene.getObjectByName('RightArm')

    if (spine) {
      spine.rotation.y = Math.sin(t * 0.55) * 0.03
      spine.rotation.x = Math.cos(t * 0.8) * 0.012 + 0.02
    }
    if (neck) {
      neck.rotation.y = Math.sin(t * 0.6) * 0.035
    }
    if (head) {
      head.rotation.y = Math.sin(t * 0.6) * 0.045
      head.rotation.x = Math.cos(t * 0.52) * 0.02
    }
    if (leftArm) {
      leftArm.rotation.z = -Math.PI / 2.8 + Math.sin(t * 0.65) * 0.03
    }
    if (rightArm) {
      rightArm.rotation.z = Math.PI / 2.8 - Math.sin(t * 0.65) * 0.03
    }

    scene.traverse((child) => {
      if (child.isMesh && child.morphTargetDictionary) {
        const index = child.morphTargetDictionary.mouthOpen || child.morphTargetDictionary.jawOpen
        if (index !== undefined) {
          const targetValue = isSpeaking ? (Math.sin(t * 18) * 0.35 + 0.35) : 0
          child.morphTargetInfluences[index] = targetValue
        }
      }
    })
  })

  if (failed || !scene) {
    return <FallbackGuide isSpeaking={isSpeaking} />
  }

  return <primitive object={scene} position={[0.22, -1.2, 0]} scale={1.08} />
}

function VrmModel({ url, isSpeaking }) {
  const [vrm, setVrm] = useState(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let disposed = false
    let loadedVrm = null
    setVrm(null)
    setFailed(false)
    const loader = new GLTFLoader()
    loader.register((parser) => new VRMLoaderPlugin(parser))

    loader.load(
      url,
      (gltf) => {
        const vrmInstance = gltf.userData.vrm
        if (vrmInstance) {
          loadedVrm = vrmInstance
          vrmInstance.scene.rotation.y = Math.PI
          if (disposed) {
            vrmInstance.dispose()
          } else {
            setVrm(vrmInstance)
          }
        }
      },
      undefined,
      (error) => {
        console.error('Error loading VRM:', error)
        if (!disposed) setFailed(true)
      }
    )

    return () => {
      disposed = true
      if (loadedVrm) {
        loadedVrm.dispose()
      }
    }
  }, [url])

  useFrame((state) => {
    if (!vrm) return
    const t = state.clock.getElapsedTime()
    vrm.update(state.clock.getDelta())

    const spine = vrm.humanoid.getRawBoneNode('spine')
    const neck = vrm.humanoid.getRawBoneNode('neck')
    const head = vrm.humanoid.getRawBoneNode('head')

    if (spine) {
      spine.rotation.y = Math.sin(t * 0.55) * 0.03
      spine.rotation.x = Math.cos(t * 0.8) * 0.012 + 0.02
    }
    if (neck) {
      neck.rotation.y = Math.sin(t * 0.6) * 0.035
    }
    if (head) {
      head.rotation.y = Math.sin(t * 0.6) * 0.045
      head.rotation.x = Math.cos(t * 0.52) * 0.02
    }

    const mouthValue = isSpeaking ? (Math.sin(t * 18) * 0.35 + 0.35) : 0
    if (vrm.expressionManager) {
      vrm.expressionManager.setValue('aa', mouthValue)
      vrm.expressionManager.update()
    } else if (vrm.blendShapeProxy) {
      vrm.blendShapeProxy.setValue('A', mouthValue)
      vrm.blendShapeProxy.update()
    }
  })

  if (failed || !vrm) {
    return <FallbackGuide isSpeaking={isSpeaking} />
  }

  return <primitive object={vrm.scene} position={[0.22, -1.2, 0]} scale={1.08} />
}

function ModelSelector({ url, isSpeaking }) {
  const isVrm = url.toLowerCase().endsWith('.vrm')

  if (isVrm) {
    return <VrmModel url={url} isSpeaking={isSpeaking} />
  }
  return <GlbModel url={url} isSpeaking={isSpeaking} />
}

function disposeScene(scene) {
  scene.traverse((child) => {
    if (!child.isMesh) return
    child.geometry?.dispose?.()
    if (Array.isArray(child.material)) {
      child.material.forEach(material => material.dispose?.())
    } else {
      child.material?.dispose?.()
    }
  })
}

function StageEffects({ isSpeaking }) {
  const orbitRef = useRef(null)
  const ringRef = useRef(null)
  const dotARef = useRef(null)
  const dotBRef = useRef(null)

  useFrame((state) => {
    const t = state.clock.getElapsedTime()
    if (orbitRef.current) orbitRef.current.rotation.y = t * 0.22
    if (ringRef.current) {
      ringRef.current.rotation.z = Math.sin(t * 0.35) * 0.12
      ringRef.current.scale.setScalar(isSpeaking ? 1.03 + Math.sin(t * 4) * 0.015 : 1)
    }
    if (dotARef.current) {
      dotARef.current.position.y = 0.64 + Math.sin(t * 1.4) * 0.06
      dotARef.current.rotation.y = t * 0.8
    }
    if (dotBRef.current) {
      dotBRef.current.position.y = -0.02 + Math.cos(t * 1.2) * 0.05
      dotBRef.current.rotation.y = -t * 0.7
    }
  })

  return (
    <group position={[0.15, -0.28, -0.22]}>
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0.08, -0.63, 0]} scale={[1.15, 1.15, 1]}>
        <torusGeometry args={[0.74, 0.012, 16, 120]} />
        <meshBasicMaterial color="#5eead4" transparent opacity={0.48} />
      </mesh>
      <mesh ref={ringRef} rotation={[Math.PI / 2.25, 0, 0.18]} position={[0.08, -0.22, -0.06]}>
        <torusGeometry args={[0.88, 0.007, 16, 144]} />
        <meshBasicMaterial color="#fbbf24" transparent opacity={0.52} />
      </mesh>
      <group ref={orbitRef}>
        <mesh ref={dotARef} position={[0.92, 0.64, 0]}>
          <sphereGeometry args={[0.055, 24, 24]} />
          <meshStandardMaterial color="#22d3ee" emissive="#0e7490" emissiveIntensity={0.75} roughness={0.32} />
        </mesh>
        <mesh ref={dotBRef} position={[-0.84, -0.02, 0]}>
          <sphereGeometry args={[0.038, 20, 20]} />
          <meshStandardMaterial color="#f59e0b" emissive="#92400e" emissiveIntensity={0.65} roughness={0.36} />
        </mesh>
      </group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0.08, -0.72, 0]} scale={[1.4, 0.45, 1]}>
        <circleGeometry args={[0.74, 64]} />
        <meshBasicMaterial color="#0f766e" transparent opacity={0.16} />
      </mesh>
    </group>
  )
}

function FallbackGuide({ isSpeaking }) {
  const groupRef = useRef(null)
  const headRef = useRef(null)

  useFrame((state) => {
    const t = state.clock.getElapsedTime()
    if (groupRef.current) {
      groupRef.current.position.y = -0.25 + Math.sin(t * 1.1) * 0.035
      groupRef.current.rotation.y = Math.sin(t * 0.55) * 0.12
    }
    if (headRef.current) {
      const pulse = isSpeaking ? 1 + Math.sin(t * 12) * 0.025 : 1
      headRef.current.scale.setScalar(pulse)
    }
  })

  return (
    <group ref={groupRef} position={[0.2, -0.25, 0]} scale={1.08}>
      <mesh position={[0, -0.42, 0]}>
        <cylinderGeometry args={[0.26, 0.34, 0.72, 32]} />
        <meshStandardMaterial color="#0891b2" roughness={0.45} metalness={0.05} />
      </mesh>
      <mesh ref={headRef} position={[0, 0.12, 0]}>
        <sphereGeometry args={[0.26, 32, 32]} />
        <meshStandardMaterial color="#f8c7a5" roughness={0.52} />
      </mesh>
      <mesh position={[0, 0.34, 0.02]} scale={[1.05, 0.45, 0.9]}>
        <sphereGeometry args={[0.22, 32, 16]} />
        <meshStandardMaterial color="#3b2416" roughness={0.5} />
      </mesh>
      <mesh position={[-0.16, 0.14, 0.23]}>
        <sphereGeometry args={[0.025, 16, 16]} />
        <meshBasicMaterial color="#1f2937" />
      </mesh>
      <mesh position={[0.16, 0.14, 0.23]}>
        <sphereGeometry args={[0.025, 16, 16]} />
        <meshBasicMaterial color="#1f2937" />
      </mesh>
      <mesh position={[0, 0.03, 0.245]} scale={[1.4, 0.5, 0.4]}>
        <sphereGeometry args={[0.035, 16, 16]} />
        <meshBasicMaterial color={isSpeaking ? '#be123c' : '#7f1d1d'} />
      </mesh>
      <mesh position={[-0.33, -0.35, 0]} rotation={[0, 0, -0.45]}>
        <cylinderGeometry args={[0.045, 0.055, 0.54, 18]} />
        <meshStandardMaterial color="#f8c7a5" roughness={0.55} />
      </mesh>
      <mesh position={[0.33, -0.35, 0]} rotation={[0, 0, 0.45]}>
        <cylinderGeometry args={[0.045, 0.055, 0.54, 18]} />
        <meshStandardMaterial color="#f8c7a5" roughness={0.55} />
      </mesh>
    </group>
  )
}

export default function AvatarCanvas({ modelUrl, isSpeaking }) {
  const defaultUrl = 'https://models.readyplayer.me/64b5e612f0e0c3453b3f66a2.glb'
  const activeUrl = modelUrl || defaultUrl

  return (
    <div className="relative h-full w-full">
      <Canvas
        camera={{ position: [0.05, 0.08, 2.35], fov: 34 }}
        dpr={[1, 1.8]}
        gl={{ antialias: true, alpha: true }}
        style={{ width: '100%', height: '100%' }}
      >
        <ambientLight intensity={1.65} />
        <directionalLight position={[2.5, 4.2, 3]} intensity={2.1} />
        <spotLight position={[-2.5, 3, 2]} angle={0.5} penumbra={0.7} intensity={1.2} color="#bae6fd" />
        <pointLight position={[0, 1.2, 1.4]} intensity={1.4} color="#fef3c7" />

        <StageEffects isSpeaking={isSpeaking} />

        <ModelSelector url={activeUrl} isSpeaking={isSpeaking} />

        <OrbitControls
          enablePan={false}
          enableZoom
          autoRotate
          autoRotateSpeed={0.28}
          minDistance={1.35}
          maxDistance={3.1}
          minPolarAngle={Math.PI / 3.4}
          maxPolarAngle={Math.PI / 1.75}
          target={[0.2, -0.2, 0]}
        />
      </Canvas>
    </div>
  )
}
