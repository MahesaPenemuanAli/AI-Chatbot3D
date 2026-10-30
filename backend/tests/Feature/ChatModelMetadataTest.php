<?php

namespace Tests\Feature;

use App\Models\ChatMessage;
use App\Models\ChatSession;
use App\Models\User;
use App\Services\GeminiChatService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class ChatModelMetadataTest extends TestCase
{
    use RefreshDatabase;

    public function test_each_answer_keeps_its_actual_model_when_the_primary_recovers(): void
    {
        Sanctum::actingAs(User::factory()->create());
        $this->mock(GeminiChatService::class, function ($mock) {
            $mock->shouldReceive('model')->andReturn('gemini-3.8-flash');
            $mock->shouldReceive('generate')->twice()->andReturn(
                ['Jawaban model cadangan.', 'gemini-3.5-flash-lite'],
                ['Jawaban model utama.', 'gemini-3.8-flash'],
            );
        });
        $session = (string) Str::uuid();
        $endpoint = '/api/chat/sessions/'.$session.'/messages';
        $this->postJson($endpoint, ['message' => 'Halo Nusa'])
            ->assertOk()->assertJsonPath('ai_message.model', 'gemini-3.5-flash-lite')
            ->assertJsonPath('ai_message.fallback_used', true);
        $this->postJson($endpoint, ['message' => 'Sekarang bantu rencanakan perjalanan.'])
            ->assertOk()->assertJsonPath('ai_message.model', 'gemini-3.8-flash')
            ->assertJsonPath('ai_message.fallback_used', false);

        $this->assertSame('gemini-3.8-flash', ChatSession::findOrFail($session)->model);
        $firstAnswer = ChatMessage::where('role', 'model')->orderBy('id')->firstOrFail();
        $this->assertSame('gemini-3.5-flash-lite', $firstAnswer->metadata['model']);
        $this->assertTrue($firstAnswer->metadata['fallback_used']);
        $this->getJson($endpoint)->assertOk()
            ->assertJsonPath('1.model', 'gemini-3.5-flash-lite')
            ->assertJsonPath('1.fallback_used', true)
            ->assertJsonPath('3.model', 'gemini-3.8-flash')
            ->assertJsonPath('3.fallback_used', false);
    }
}
