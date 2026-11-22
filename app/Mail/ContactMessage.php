<?php

namespace App\Mail;

use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Address;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;

class ContactMessage extends Mailable
{
    public function __construct(public array $submission) {}

    public function envelope(): Envelope
    {
        return new Envelope(
            replyTo: [new Address($this->submission['email'])],
            subject: '[DQX Tools] お問い合わせ / Contact',
        );
    }

    public function content(): Content
    {
        return new Content(text: 'mail.contact-message');
    }
}
