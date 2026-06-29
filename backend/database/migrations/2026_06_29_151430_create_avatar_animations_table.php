<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('avatar_animations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('avatar_id')->constrained()->cascadeOnDelete();
            $table->string('emotion'); // happy, sad, angry, thinking, neutral, greeting
            $table->string('animation_url'); // Path to animation file (.fbx / .gltf)
            $table->boolean('loop')->default(false);
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('avatar_animations');
    }
};
