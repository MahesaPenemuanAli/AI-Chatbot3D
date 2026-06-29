import React, { Suspense, useState, useEffect, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, useGLTF } from '@react-three/drei'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { VRMLoaderPlugin } from '@pixiv/three-vrm'
import { Loader2 } from 'lucide-react'

function GlbModel({ url, isSpeaking }) {
  const { scene } = useGLTF(url)
  
  useFrame((state) => {
    const t = state.clock.getElapsedTime()
    const spine = scene.getObjectByName('Spine')
    const neck = scene.getObjectByName('Neck')
    const head = scene.getObjectByName('Head')
    const leftArm = scene.getObjectByName('LeftArm')
    const rightArm = scene.getObjectByName('RightArm')

    if (spine) {
      spine.rotation.y = Math.sin(t * 0.5) * 0.02
      spine.rotation.x = Math.cos(t * 0.8) * 0.01 + 0.02
    }
    if (neck) {
      neck.rotation.y = Math.sin(t * 0.5) * 0.03
    }
    if (head) {
      head.rotation.y = Math.sin(t * 0.5) * 0.04
      head.rotation.x = Math.cos(t * 0.5) * 0.02
    }
    if (leftArm) {
      leftArm.rotation.z = -Math.PI / 2.8 + Math.sin(t * 0.5) * 0.02
    }
    if (rightArm) {
      rightArm.rotation.z = Math.PI / 2.8 - Math.sin(t * 0.5) * 0.02
    }

    scene.traverse((child) => {
      if (child.isMesh && child.morphTargetDictionary) {
        const index = child.morphTargetDictionary['mouthOpen'] || child.morphTargetDictionary['jawOpen']
        if (index !== undefined) {
          const targetValue = isSpeaking ? (Math.sin(t * 15) * 0.35 + 0.35) : 0
          child.morphTargetInfluences[index] = targetValue
        }
      }
    })
  })

  return <primitive object={scene} position={[0, -1.6, 0]} scale={1.1} />
}

function VrmModel({ url, isSpeaking }) {
  const [vrm, setVrm] = useState(null)

  useEffect(() => {
    const loader = new GLTFLoader()
    loader.register((parser) => new VRMLoaderPlugin(parser))
    
    loader.load(
      url,
      (gltf) => {
        const vrmInstance = gltf.userData.vrm
        if (vrmInstance) {
          vrmInstance.scene.rotation.y = Math.PI
          setVrm(vrmInstance)
        }
      },
      undefined,
      (error) => {
        console.error('Error loading VRM:', error)
      }
    )

    return () => {
      if (vrm) {
        vrm.dispose()
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
      spine.rotation.y = Math.sin(t * 0.5) * 0.02
      spine.rotation.x = Math.cos(t * 0.8) * 0.01 + 0.02
    }
    if (neck) {
      neck.rotation.y = Math.sin(t * 0.5) * 0.03
    }
    if (head) {
      head.rotation.y = Math.sin(t * 0.5) * 0.04
      head.rotation.x = Math.cos(t * 0.5) * 0.02
    }

    const mouthValue = isSpeaking ? (Math.sin(t * 15) * 0.35 + 0.35) : 0
    if (vrm.expressionManager) {
      vrm.expressionManager.setValue('aa', mouthValue)
      vrm.expressionManager.update()
    } else if (vrm.blendShapeProxy) {
      vrm.blendShapeProxy.setValue('A', mouthValue)
      vrm.blendShapeProxy.update()
    }
  })

  return vrm ? <primitive object={vrm.scene} position={[0, -1.6, 0]} scale={1.1} /> : null
}

function ModelSelector({ url, isSpeaking }) {
  const isVrm = url.toLowerCase().endsWith('.vrm')
  
  if (isVrm) {
    return <VrmModel url={url} isSpeaking={isSpeaking} />
  }
  return <GlbModel url={url} isSpeaking={isSpeaking} />
}

export default function AvatarCanvas({ modelUrl, isSpeaking }) {
  const defaultUrl = 'https://models.readyplayer.me/64b5e612f0e0c3453b3f66a2.glb'
  const activeUrl = modelUrl || defaultUrl

  return (
    <div className="w-full h-full relative rounded-2xl overflow-hidden bg-gradient-to-b from-emerald-950/10 to-black/30 border border-white/5 shadow-inner">
      <Suspense fallback={
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/40 backdrop-blur-sm">
          <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
          <span className="text-[10px] uppercase tracking-wider font-bold text-emerald-500/80">Memuat Pemandu 3D...</span>
        </div>
      }>
        <Canvas
          camera={{ position: [0, 0, 1.8], fov: 45 }}
          style={{ width: '100%', height: '100%' }}
        >
          <ambientLight intensity={1.5} />
          <directionalLight position={[2, 4, 3]} intensity={2} />
          <spotLight position={[-2, 4, -3]} intensity={1} />
          <pointLight position={[0, 2, 2]} intensity={1.5} />
          
          <ModelSelector url={activeUrl} isSpeaking={isSpeaking} />
          
          <OrbitControls 
            enablePan={false}
            minDistance={0.8}
            maxDistance={3.5}
            minPolarAngle={Math.PI / 3}
            maxPolarAngle={Math.PI / 1.8}
            target={[0, -0.2, 0]}
          />
        </Canvas>
      </Suspense>
    </div>
  )
}
