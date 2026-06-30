<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\Avatar;
use App\Models\AvatarAnimation;

class AvatarSeeder extends Seeder
{
    public function run(): void
    {
        Avatar::query()->delete();
        AvatarAnimation::query()->delete();

        $guides = [
          [
            'name' => 'Siti',
            'description' => 'Pemandu Alam & Petualangan Indonesia',
            'model_url' => 'https://models.readyplayer.me/64b5e612f0e0c3453b3f66a2.glb',
            'voice_id' => '21m00Tcm4TlvDq8ikWAM',
            'personality_prompt' => 'Kamu adalah "Siti", asisten AI pemandu pariwisata petualangan dan alam Indonesia yang ramah, berenergi tinggi, dan menyukai kegiatan outdoor. Berikan rekomendasi gunung, pantai, taman nasional, dan kegiatan menantang dengan penuh semangat.',
            'animations' => [
              ['emotion' => 'neutral', 'animation_url' => 'https://assets.tripmate.ai/animations/siti_idle.fbx', 'loop' => true],
              ['emotion' => 'greeting', 'animation_url' => 'https://assets.tripmate.ai/animations/siti_wave.fbx', 'loop' => false],
              ['emotion' => 'happy', 'animation_url' => 'https://assets.tripmate.ai/animations/siti_laugh.fbx', 'loop' => false],
              ['emotion' => 'thinking', 'animation_url' => 'https://assets.tripmate.ai/animations/siti_think.fbx', 'loop' => true],
            ]
          ],
          [
            'name' => 'Budi',
            'description' => 'Pemandu Sejarah & Warisan Budaya Indonesia',
            'model_url' => 'https://models.readyplayer.me/64b5e6cf2c2f6d0f507b56a1.glb',
            'voice_id' => 'AZnzlk1XvdvUeBnXmlld',
            'personality_prompt' => 'Kamu adalah "Budi", asisten AI pemandu pariwisata sejarah dan warisan budaya Indonesia yang bijaksana, santun, dan sangat berpengetahuan luas. Jelaskan latar belakang sejarah candi, museum, desa adat, dan tradisi lokal dengan mendalam.',
            'animations' => [
              ['emotion' => 'neutral', 'animation_url' => 'https://assets.tripmate.ai/animations/budi_idle.fbx', 'loop' => true],
              ['emotion' => 'greeting', 'animation_url' => 'https://assets.tripmate.ai/animations/budi_bow.fbx', 'loop' => false],
              ['emotion' => 'happy', 'animation_url' => 'https://assets.tripmate.ai/animations/budi_smile.fbx', 'loop' => false],
              ['emotion' => 'thinking', 'animation_url' => 'https://assets.tripmate.ai/animations/budi_ponder.fbx', 'loop' => true],
            ]
          ],
          [
            'name' => 'Aditya',
            'description' => 'Pemandu Kuliner & Rekreasi Indonesia',
            'model_url' => 'https://models.readyplayer.me/64b5e7392c2f6d0f507b5a83.glb',
            'voice_id' => 'EXAVITQu4vr4xnSDxMaL',
            'personality_prompt' => 'Kamu adalah "Aditya", asisten AI pemandu kuliner dan rekreasi keluarga Indonesia yang ceria, santai, dan penuh selera. Berikan rekomendasi jajanan pasar, tempat makan legendaris, restoran keluarga, dan tempat rekreasi modern terpopuler.',
            'animations' => [
              ['emotion' => 'neutral', 'animation_url' => 'https://assets.tripmate.ai/animations/aditya_idle.fbx', 'loop' => true],
              ['emotion' => 'greeting', 'animation_url' => 'https://assets.tripmate.ai/animations/aditya_handshake.fbx', 'loop' => false],
              ['emotion' => 'happy', 'animation_url' => 'https://assets.tripmate.ai/animations/aditya_cheer.fbx', 'loop' => false],
              ['emotion' => 'thinking', 'animation_url' => 'https://assets.tripmate.ai/animations/aditya_scratch_head.fbx', 'loop' => true],
            ]
          ]
        ];

        foreach ($guides as $guideData) {
            $avatar = Avatar::create([
                'name' => $guideData['name'],
                'description' => $guideData['description'],
                'model_url' => $guideData['model_url'],
                'voice_id' => $guideData['voice_id'],
                'personality_prompt' => $guideData['personality_prompt'],
            ]);

            foreach ($guideData['animations'] as $anim) {
                AvatarAnimation::create([
                    'avatar_id' => $avatar->id,
                    'emotion' => $anim['emotion'],
                    'animation_url' => $anim['animation_url'],
                    'loop' => $anim['loop'],
                ]);
            }
        }
    }
}
