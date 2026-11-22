<?php

namespace Tests\Feature;

use App\Mail\ContactMessage;
use Illuminate\Support\Facades\Mail;
use Tests\TestCase;

class ContactTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        config(['contact.recipient' => 'operator@example.test', 'contact.mailer' => 'smtp']);
        Mail::fake();
    }

    private function payload(): array
    {
        return ['name' => 'Test', 'email' => 'visitor@example.test', 'category' => 'bug',
            'message' => 'A test message for the contact form.', 'privacy' => true, 'website' => '', 'locale' => 'ja'];
    }

    public function test_sends_only_to_operator_and_uses_visitor_as_reply_to(): void
    {
        $this->postJson('/api/contact', $this->payload())->assertOk()->assertJson(['code' => 'sent']);
        Mail::assertSent(ContactMessage::class, function ($mail) {
            return $mail->hasTo('operator@example.test')
                && ! $mail->hasTo('visitor@example.test')
                && $mail->envelope()->replyTo[0]->address === 'visitor@example.test';
        });
        Mail::assertSentCount(1);
    }

    public function test_rejects_invalid_input_and_missing_consent(): void
    {
        $this->postJson('/api/contact', array_replace($this->payload(), [
            'email' => "bad\r\nBcc: other@example.test", 'category' => 'invalid', 'message' => 'short', 'privacy' => false,
        ]))->assertUnprocessable()->assertJsonValidationErrors(['email', 'category', 'message', 'privacy']);
        Mail::assertNothingSent();
    }

    public function test_honeypot_does_not_send_mail(): void
    {
        $this->postJson('/api/contact', array_replace($this->payload(), ['website' => 'spam']))->assertUnprocessable();
        Mail::assertNothingSent();
    }

    public function test_missing_recipient_or_log_mailer_is_not_reported_as_success(): void
    {
        config(['contact.recipient' => null]);
        $this->postJson('/api/contact', $this->payload())->assertStatus(503);
        config(['contact.recipient' => 'operator@example.test', 'contact.mailer' => 'log']);
        $this->postJson('/api/contact', $this->payload())->assertStatus(503);
        Mail::assertNothingSent();
    }

    public function test_delivery_failure_returns_error(): void
    {
        Mail::shouldReceive('mailer')->with('smtp')->once()->andReturnSelf();
        Mail::shouldReceive('to')->with('operator@example.test')->once()->andReturnSelf();
        Mail::shouldReceive('send')->once()->andThrow(new \RuntimeException('Unavailable'));
        $this->postJson('/api/contact', $this->payload())->assertStatus(503)->assertJson(['code' => 'delivery_failed']);
    }

    public function test_rate_limit_stops_fourth_submission(): void
    {
        for ($i = 0; $i < 3; $i++) {
            $this->postJson('/api/contact', $this->payload())->assertOk();
        }
        $this->postJson('/api/contact', $this->payload())->assertStatus(429);
        Mail::assertSentCount(3);
    }
}
