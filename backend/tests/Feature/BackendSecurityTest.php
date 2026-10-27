<?php

namespace Tests\Feature;

use App\Models\ChatSession;
use App\Models\User;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class BackendSecurityTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        config(['services.gemini.key' => 'test-only-key', 'services.gemini.ca_bundle' => null]);
        Http::preventStrayRequests();
        Http::fake(['generativelanguage.googleapis.com/*' => Http::response([
            'candidates' => [['content' => ['parts' => [['text' => 'Jawaban wisata.']]]]],
        ])]);
        Storage::fake('local');
        Storage::fake('public');
    }

    public function test_active_content_uploads_are_rejected_before_the_provider_or_storage(): void
    {
        Sanctum::actingAs(User::factory()->create());
        foreach (['html' => '<html><script>alert(1)</script></html>', 'svg' => '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'] as $extension => $content) {
            $this->postJson($this->endpoint(), ['attachments' => [UploadedFile::fake()->createWithContent('unsafe.'.$extension, $content)]])
                ->assertUnprocessable()->assertJsonValidationErrors('attachments.0');
        }
        Http::assertNothingSent();
        $this->assertDatabaseCount('chat_messages', 0);
        $this->assertSame([], Storage::disk('local')->allFiles());
        $this->assertSame([], Storage::disk('public')->allFiles());
    }

    public function test_upload_count_and_combined_size_are_enforced_on_the_api(): void
    {
        Sanctum::actingAs(User::factory()->create());
        $this->postJson($this->endpoint(), ['attachments' => array_map(fn ($n) => $this->image("photo{$n}.png"), range(1, 5))])
            ->assertUnprocessable()->assertJsonValidationErrors('attachments');
        $this->postJson($this->endpoint(), ['attachments' => [
            UploadedFile::fake()->create('first.png', 11000, 'image/png'),
            UploadedFile::fake()->create('second.png', 11000, 'image/png'),
        ]])->assertUnprocessable()->assertJsonValidationErrors('attachments');
        Http::assertNothingSent();
        $this->assertDatabaseCount('message_attachments', 0);
    }

    public function test_media_is_private_and_only_an_untampered_unexpired_signed_link_can_download_it(): void
    {
        Sanctum::actingAs($owner = User::factory()->create());
        $endpoint = $this->endpoint();
        $response = $this->postJson($endpoint, ['message' => 'Jelaskan foto', 'attachments' => [$this->image()]])->assertOk();
        $attachment = $response->json('user_message.attachments.0');
        $this->assertStringStartsWith('private/attachments/', $attachment['file_path']);
        $path = substr($attachment['file_path'], strlen('private/'));
        Storage::disk('local')->assertExists($path);
        Storage::disk('public')->assertMissing($path);
        $url = $attachment['download_url'];
        $this->get($url)->assertOk()->assertHeader('X-Content-Type-Options', 'nosniff')->assertHeader('Content-Type', 'image/png');
        $this->get('/api/chat/attachments/'.$attachment['id'])->assertForbidden();
        $this->get($url.'x')->assertForbidden();
        Sanctum::actingAs(User::factory()->create());
        $this->getJson($endpoint)->assertNotFound();
        $this->deleteJson(str_replace('/messages', '', $endpoint))->assertNotFound();
        Storage::disk('local')->assertExists($path);
        $this->travel(16)->minutes();
        $this->get($url)->assertForbidden();
        Sanctum::actingAs($owner);
        $refreshed = $this->getJson($endpoint)->assertOk()->json('0.attachments.0.download_url');
        $this->assertNotSame($url, $refreshed);
        $this->get($refreshed)->assertOk();
        $this->deleteJson(str_replace('/messages', '', $endpoint))->assertOk();
        Storage::disk('local')->assertMissing($path);
        $this->assertDatabaseCount('message_attachments', 0);
        $this->get($refreshed)->assertNotFound();
    }

    public function test_deleting_a_session_also_removes_legacy_public_uploads(): void
    {
        Sanctum::actingAs($owner = User::factory()->create());
        $session = $this->createChatSession($owner);
        $message = $session->messages()->create(['role' => 'user', 'message_type' => 'multimodal', 'content' => 'Foto']);
        Storage::disk('public')->put('attachments/legacy.png', 'old-photo');
        $message->attachments()->create(['attachment_type' => 'image', 'file_path' => 'storage/attachments/legacy.png', 'file_name' => 'legacy.png', 'mime_type' => 'image/png', 'file_size' => 9]);
        $this->deleteJson('/api/chat/sessions/'.$session->id)->assertOk();
        Storage::disk('public')->assertMissing('attachments/legacy.png');
        $this->assertDatabaseCount('chat_sessions', 0);
        $this->assertDatabaseCount('chat_messages', 0);
        $this->assertDatabaseCount('message_attachments', 0);
    }

    public function test_private_download_urls_preserve_a_backend_subdirectory(): void
    {
        Sanctum::actingAs($owner = User::factory()->create());
        $session = $this->createChatSession($owner);
        $message = $session->messages()->create(['role' => 'user', 'message_type' => 'multimodal', 'content' => 'Foto']);
        Storage::disk('local')->put('attachments/photo.png', 'photo');
        $message->attachments()->create(['attachment_type' => 'image', 'file_path' => 'private/attachments/photo.png', 'file_name' => 'photo.png', 'mime_type' => 'image/png', 'file_size' => 5]);
        $server = ['SCRIPT_NAME' => '/nusa/index.php', 'SCRIPT_FILENAME' => '/var/www/nusa/index.php', 'HTTP_ACCEPT' => 'application/json'];
        $url = $this->call('GET', 'http://localhost/nusa/api/chat/sessions/'.$session->id.'/messages', server: $server)->assertOk()->json('0.attachments.0.download_url');
        $this->assertStringStartsWith('/nusa/api/chat/attachments/', $url);
        $this->call('GET', 'http://localhost'.$url, server: $server)->assertOk();
    }

    public function test_legacy_migration_is_read_only_by_default_and_apply_preserves_content(): void
    {
        $session = $this->createChatSession(User::factory()->create());
        $message = $session->messages()->create(['role' => 'user', 'message_type' => 'multimodal', 'content' => 'Foto']);
        Storage::disk('public')->put('attachments/legacy.png', 'legacy-photo');
        $attachment = $message->attachments()->create(['attachment_type' => 'image', 'file_path' => 'storage/attachments/legacy.png', 'file_name' => 'legacy.png', 'mime_type' => 'image/png', 'file_size' => 12]);
        $this->artisan('attachments:privatize')->assertSuccessful();
        Storage::disk('public')->assertExists('attachments/legacy.png');
        $this->assertSame([], Storage::disk('local')->allFiles());
        $this->assertSame('storage/attachments/legacy.png', $attachment->fresh()->file_path);
        $this->artisan('attachments:privatize', ['--apply' => true])->assertSuccessful();
        Storage::disk('public')->assertMissing('attachments/legacy.png');
        $privatePath = $attachment->fresh()->file_path;
        $this->assertStringStartsWith('private/attachments/', $privatePath);
        $this->assertSame('legacy-photo', Storage::disk('local')->get(substr($privatePath, strlen('private/'))));
        $this->artisan('attachments:privatize', ['--apply' => true])->assertSuccessful();
        $this->assertCount(1, Storage::disk('local')->allFiles());
    }

    public function test_outbound_history_is_bounded_and_chronological_without_deleting_the_archive(): void
    {
        Sanctum::actingAs($owner = User::factory()->create());
        $session = $this->createChatSession($owner);
        foreach (range(1, 24) as $n) {
            $session->messages()->create(['role' => $n % 2 ? 'user' : 'model', 'message_type' => 'text', 'content' => "Pesan {$n}"]);
        }
        $this->postJson('/api/chat/sessions/'.$session->id.'/messages', ['message' => 'Lanjutkan'])->assertOk();
        Http::assertSent(fn ($request) => count($request['contents']) === 21
            && $request['contents'][0]['parts'][0]['text'] === 'Pesan 5'
            && $request['contents'][19]['parts'][0]['text'] === 'Pesan 24'
            && $request['contents'][20]['parts'][0]['text'] === 'Lanjutkan');
        $this->assertDatabaseCount('chat_messages', 26);
    }

    public function test_login_is_rate_limited_with_retry_after_even_when_email_case_changes(): void
    {
        foreach (range(1, 5) as $attempt) {
            $this->postJson('/api/login', ['email' => $attempt % 2 ? 'USER@example.test' : 'user@example.test', 'password' => 'incorrect'])->assertUnprocessable();
        }
        $this->postJson('/api/login', ['email' => 'user@example.test', 'password' => 'incorrect'])
            ->assertStatus(429)->assertJsonPath('code', 'RATE_LIMITED')->assertHeader('Retry-After');
    }

    public function test_chat_requests_are_limited_per_user_before_calling_provider(): void
    {
        Sanctum::actingAs(User::factory()->create());
        foreach (range(1, 10) as $attempt) {
            $this->postJson($this->endpoint(), ['message' => ''])->assertUnprocessable();
        }
        $this->postJson($this->endpoint(), ['message' => 'Halo'])->assertStatus(429)->assertHeader('Retry-After');
        Http::assertNothingSent();
    }

    public function test_registration_normalizes_email_and_never_exposes_passwords(): void
    {
        $payload = ['name' => 'Pelancong', 'email' => 'Travel@Example.test', 'password' => 'safe-password', 'password_confirmation' => 'safe-password'];
        $this->postJson('/api/register', $payload)->assertCreated()->assertJsonPath('user.email', 'travel@example.test')->assertJsonMissingPath('user.password');
        $this->assertDatabaseHas('users', ['email' => 'travel@example.test']);
        $this->postJson('/api/login', ['email' => 'TRAVEL@example.test', 'password' => 'safe-password'])->assertOk()->assertJsonMissingPath('user.password');
        $this->postJson('/api/register', $payload)->assertUnprocessable()->assertJsonValidationErrors('email');
        $this->assertDatabaseCount('users', 1);
    }

    public function test_malformed_identity_and_oversized_multibyte_password_are_validation_errors(): void
    {
        $this->postJson('/api/login', ['email' => ['unexpected'], 'password' => 'safe-password'])->assertUnprocessable()->assertJsonValidationErrors('email');
        $this->postJson('/api/register', ['name' => 'Traveler', 'email' => 'travel@example.test', 'password' => str_repeat('密', 30), 'password_confirmation' => str_repeat('密', 30)])
            ->assertUnprocessable()->assertJsonValidationErrors('password');
        $this->assertDatabaseCount('users', 0);
    }

    public function test_registration_rolls_back_the_user_if_token_creation_fails(): void
    {
        Schema::drop('personal_access_tokens');
        $this->withoutExceptionHandling();
        try {
            $this->postJson('/api/register', ['name' => 'Traveler', 'email' => 'travel@example.test', 'password' => 'safe-password', 'password_confirmation' => 'safe-password']);
            $this->fail('Token creation should fail after dropping its table.');
        } catch (QueryException) {
            $this->assertDatabaseCount('users', 0);
        }
    }

    public function test_bearer_token_expires_after_the_configured_lifetime(): void
    {
        config(['sanctum.expiration' => 10080]);
        $token = User::factory()->create()->createToken('test')->plainTextToken;
        $this->withToken($token)->getJson('/api/user')->assertOk();
        $this->travel(8)->days();
        $this->app['auth']->forgetGuards();
        $this->withToken($token)->getJson('/api/user')->assertUnauthorized();
    }

    public function test_logout_revokes_only_the_current_bearer_token(): void
    {
        $user = User::factory()->create();
        $first = $user->createToken('first')->plainTextToken;
        $second = $user->createToken('second')->plainTextToken;
        $this->withToken($first)->postJson('/api/logout')->assertOk();
        $this->app['auth']->forgetGuards();
        $this->withToken($first)->getJson('/api/user')->assertUnauthorized();
        $this->app['auth']->forgetGuards();
        $this->withToken($second)->getJson('/api/user')->assertOk();
    }

    private function endpoint(): string
    {
        return '/api/chat/sessions/'.Str::uuid().'/messages';
    }

    private function image(string $name = 'photo.png'): UploadedFile
    {
        return UploadedFile::fake()->createWithContent($name, base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jGZkAAAAASUVORK5CYII='));
    }

    private function createChatSession(User $owner): ChatSession
    {
        return ChatSession::create(['id' => (string) Str::uuid(), 'user_id' => $owner->id, 'title' => 'Perjalanan', 'model' => 'gemini-2.5-flash']);
    }
}
