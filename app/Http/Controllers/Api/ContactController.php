<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Mail\ContactMessage;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Illuminate\Validation\Rule;
use Throwable;

class ContactController extends Controller
{
    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => ['nullable', 'string', 'max:80', 'not_regex:/[\r\n]/'],
            'email' => ['required', 'string', 'email:rfc', 'max:254', 'not_regex:/[\r\n]/'],
            'category' => ['required', Rule::in(['feedback', 'bug', 'content', 'privacy', 'other'])],
            'message' => ['required', 'string', 'min:10', 'max:5000'],
            'privacy' => ['required', 'accepted'],
            'website' => ['nullable', 'string', 'max:200'],
            'locale' => ['required', Rule::in(['ja', 'en'])],
        ]);

        if (! empty($data['website'])) {
            return response()->json(['code' => 'invalid_submission'], 422);
        }

        $recipient = config('contact.recipient');
        $mailer = config('contact.mailer');
        $transport = is_string($mailer) ? config("mail.mailers.{$mailer}.transport") : null;
        // Do not report delivery for log/array transports or fallback-to-log mailers.
        if (! filter_var($recipient, FILTER_VALIDATE_EMAIL)
            || ! in_array($transport, ['smtp', 'sendmail', 'ses', 'ses-v2', 'postmark', 'resend', 'mailgun'], true)) {
            return response()->json(['code' => 'contact_unavailable'], 503);
        }

        try {
            Mail::mailer($mailer)->to($recipient)->send(new ContactMessage($data));
        } catch (Throwable $exception) {
            // Transport exceptions can contain credentials or message contents.
            Log::warning('Contact email delivery failed.', ['exception_type' => get_class($exception)]);
            return response()->json(['code' => 'delivery_failed'], 503);
        }

        return response()->json(['code' => 'sent']);
    }
}
