<?php

namespace Tests\Feature;

use App\Models\ChatSession;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Env;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class ChatSessionAccessTest extends TestCase
{
    use RefreshDatabase;

    public function test_a_user_cannot_write_to_another_users_session(): void
    {
        Http::preventStrayRequests();
        $owner = User::factory()->create();
        $otherUser = User::factory()->create();
        $session = ChatSession::create([
            'id' => (string) Str::uuid(),
            'user_id' => $owner->id,
            'title' => 'Perjalanan pribadi',
            'model' => 'gemini-2.5-flash',
        ]);
        $session->messages()->create([
            'role' => 'user',
            'message_type' => 'text',
            'content' => 'Catatan pemilik',
        ]);

        Sanctum::actingAs($otherUser);

        $this->postJson("/api/chat/sessions/{$session->id}/messages", [
            'message' => 'Pesan dari pengguna lain',
        ])->assertNotFound();

        $this->assertDatabaseCount('chat_messages', 1);
        $this->assertDatabaseHas('chat_sessions', [
            'id' => $session->id,
            'user_id' => $owner->id,
        ]);
        Http::assertNothingSent();
    }

    public function test_a_user_can_create_a_uuid_session_and_receive_a_reply(): void
    {
        // The fake HTTP response keeps this test offline even if a real key is configured.
        Env::getRepository()->set('GEMINI_API_KEY', 'nusa-test-only-key');
        Http::preventStrayRequests();
        Http::fake([
            'generativelanguage.googleapis.com/*' => Http::response([
                'candidates' => [[
                    'content' => ['parts' => [['text' => 'Halo! Mari jelajahi Yogyakarta bersama Nusa AI.']]],
                ]],
            ]),
        ]);
        $user = User::factory()->create();
        $sessionId = (string) Str::uuid();
        Sanctum::actingAs($user);

        $this->postJson("/api/chat/sessions/{$sessionId}/messages", [
            'message' => 'Bantu rencanakan perjalanan ke Yogyakarta',
        ])->assertOk()
            ->assertJsonPath('user_message.content', 'Bantu rencanakan perjalanan ke Yogyakarta')
            ->assertJsonPath('ai_message.role', 'assistant')
            ->assertJsonPath('ai_message.content', 'Halo! Mari jelajahi Yogyakarta bersama Nusa AI.');

        $this->assertDatabaseHas('chat_sessions', [
            'id' => $sessionId,
            'user_id' => $user->id,
        ]);
        $this->assertDatabaseCount('chat_messages', 2);
        Http::assertSentCount(1);
    }
}
