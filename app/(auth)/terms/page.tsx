"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import Link from "next/link"
import { ArrowLeft, FileText, Calendar, Shield, UserCheck } from "lucide-react"

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 p-4">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <Link 
            href="/register" 
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Registration
          </Link>
        </div>

        <Card className="border-2 shadow-xl">
          <CardHeader>
            <CardTitle className="text-3xl font-bold text-center flex items-center justify-center gap-3">
              <FileText className="h-8 w-8 text-primary" />
              Terms and Conditions
            </CardTitle>
            <p className="text-center text-muted-foreground">
              Effective Date: January 1, 2025<br />
              Last Updated: January 1, 2025
            </p>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[600px] w-full pr-4">
              <div className="space-y-8">
                {/* Acceptance of Terms */}
                <section>
                  <h2 className="text-2xl font-semibold mb-4 flex items-center gap-2">
                    <UserCheck className="h-6 w-6 text-primary" />
                    1. Acceptance of Terms
                  </h2>
                  <p className="text-muted-foreground leading-relaxed mb-4">
                    Welcome to Plate ("we," "us," "our," or the "App"), a restaurant reservation platform operated by Qwerty App. By downloading, installing, accessing, or using Plate, you ("you," "your," or "User") agree to be bound by these Terms and Conditions ("Terms"). If you do not agree to these Terms, please do not use our App.
                  </p>
                  
                  <div className="space-y-4 text-muted-foreground">
                    <div>
                      <h3 className="text-lg font-medium text-foreground mb-2">1.1 Eligibility</h3>
                      <ul className="list-disc pl-6 space-y-2">
                        <li>You must be at least 18 years old to use Plate</li>
                        <li>You must have the legal capacity to enter into binding contracts</li>
                        <li>You must provide accurate, current, and complete information during registration</li>
                        <li>You are responsible for maintaining the confidentiality of your account credentials</li>
                      </ul>
                    </div>
                    
                    <div>
                      <h3 className="text-lg font-medium text-foreground mb-2">1.2 Account Types</h3>
                      <p className="mb-3">Plate offers the following account types:</p>
                      <ul className="list-disc pl-6 space-y-2">
                        <li><strong>Registered Users:</strong> Full access to all features with authenticated account</li>
                        <li><strong>Guest Users:</strong> Limited access to browse restaurants without booking capabilities</li>
                        <li><strong>OAuth Users:</strong> Authenticated via Google or Apple Sign-In</li>
                      </ul>
                    </div>
                  </div>
                </section>

                <Separator />

                {/* Services Provided */}
                <section>
                  <h2 className="text-2xl font-semibold mb-4">2. Services Provided</h2>
                  <div className="space-y-4 text-muted-foreground">
                    <div>
                      <h3 className="text-lg font-medium text-foreground mb-2">2.1 Core Services</h3>
                      <p className="mb-3">Plate provides the following services:</p>
                      <ul className="list-disc pl-6 space-y-2">
                        <li>Restaurant discovery and search</li>
                        <li>Real-time table reservation booking</li>
                        <li>Restaurant information, menus, and reviews</li>
                        <li>Location-based restaurant recommendations</li>
                        <li>Social features for sharing dining experiences</li>
                        <li>Loyalty program with points and tier benefits</li>
                        <li>Special offers and promotional deals</li>
                        <li>Group booking coordination</li>
                        <li>Waitlist management</li>
                      </ul>
                    </div>
                    
                    <div>
                      <h3 className="text-lg font-medium text-foreground mb-2">2.2 Service Availability</h3>
                      <ul className="list-disc pl-6 space-y-2">
                        <li>Services are provided "as is" and "as available"</li>
                        <li>We do not guarantee uninterrupted or error-free service</li>
                        <li>Restaurant availability and booking confirmations are subject to restaurant policies</li>
                        <li>We reserve the right to modify, suspend, or discontinue services at any time</li>
                      </ul>
                    </div>
                  </div>
                </section>

                <Separator />

                {/* Account Registration */}
                <section>
                  <h2 className="text-2xl font-semibold mb-4">3. Account Registration and Use</h2>
                  <div className="space-y-4 text-muted-foreground">
                    <div>
                      <h3 className="text-lg font-medium text-foreground mb-2">Restaurant Accounts</h3>
                      <ul className="list-disc pl-6 space-y-2">
                        <li>You must provide accurate and complete information during registration</li>
                        <li>You are responsible for maintaining the security of your account credentials</li>
                        <li>You must notify us immediately of any unauthorized use of your account</li>
                        <li>Only authorized restaurant staff may access and use the management system</li>
                        <li>Each restaurant is limited to one primary account per establishment</li>
                      </ul>
                    </div>
                    <div>
                      <h3 className="text-lg font-medium text-foreground mb-2">Customer Information</h3>
                      <ul className="list-disc pl-6 space-y-2">
                        <li>Customer data must be collected and used only for booking and service purposes</li>
                        <li>Restaurants must obtain consent before storing customer information</li>
                        <li>Customer data must be kept confidential and secure</li>
                      </ul>
                    </div>
                  </div>
                </section>

                <Separator />

                {/* Booking Terms */}
                <section>
                  <h2 className="text-2xl font-semibold mb-4 flex items-center gap-2">
                    <Calendar className="h-6 w-6 text-primary" />
                    4. Booking and Reservation Terms
                  </h2>
                  <div className="space-y-4 text-muted-foreground">
                    <div>
                      <h3 className="text-lg font-medium text-foreground mb-2">Booking Policies</h3>
                      <ul className="list-disc pl-6 space-y-2">
                        <li>All bookings are subject to restaurant availability and confirmation</li>
                        <li>Restaurants may set their own cancellation and no-show policies</li>
                        <li>Customers must provide accurate contact information for bookings</li>
                        <li>Special dietary requirements and allergies should be noted during booking</li>
                        <li>Group size changes should be communicated to the restaurant in advance</li>
                      </ul>
                    </div>
                    <div>
                      <h3 className="text-lg font-medium text-foreground mb-2">Cancellations and Modifications</h3>
                      <ul className="list-disc pl-6 space-y-2">
                        <li>Cancellation policies are set by individual restaurants</li>
                        <li>Late cancellations or no-shows may result in charges as per restaurant policy</li>
                        <li>Booking modifications are subject to availability</li>
                        <li>We reserve the right to cancel bookings in case of technical issues or force majeure</li>
                      </ul>
                    </div>
                  </div>
                </section>

                <Separator />

                {/* Data Protection */}
                <section>
                  <h2 className="text-2xl font-semibold mb-4 flex items-center gap-2">
                    <Shield className="h-6 w-6 text-primary" />
                    5. Data Protection and Privacy
                  </h2>
                  <div className="space-y-3 text-muted-foreground">
                    <p>
                      We are committed to protecting your privacy and personal data. Our data handling practices are governed by our Privacy Policy, which forms an integral part of these Terms.
                    </p>
                    <ul className="list-disc pl-6 space-y-2">
                      <li>Personal data is processed lawfully, fairly, and transparently</li>
                      <li>Data is collected for specific, legitimate purposes only</li>
                      <li>We implement appropriate security measures to protect personal data</li>
                      <li>Data retention periods comply with legal requirements and business needs</li>
                      <li>Users have rights regarding their personal data as outlined in our Privacy Policy</li>
                    </ul>
                  </div>
                </section>

                <Separator />

                {/* Service Availability */}
                <section>
                  <h2 className="text-2xl font-semibold mb-4">6. Service Availability and Limitations</h2>
                  <div className="space-y-3 text-muted-foreground">
                    <p>
                      We strive to provide continuous service availability but cannot guarantee uninterrupted access:
                    </p>
                    <ul className="list-disc pl-6 space-y-2">
                      <li>The service may experience downtime for maintenance or technical issues</li>
                      <li>We are not liable for losses due to service interruptions</li>
                      <li>Restaurant data is backed up regularly, but we recommend maintaining your own records</li>
                      <li>Third-party integrations may affect service functionality</li>
                    </ul>
                  </div>
                </section>

                <Separator />

                {/* Prohibited Uses */}
                <section>
                  <h2 className="text-2xl font-semibold mb-4">7. Prohibited Uses</h2>
                  <div className="space-y-3 text-muted-foreground">
                    <p>You agree not to use the service for:</p>
                    <ul className="list-disc pl-6 space-y-2">
                      <li>Any unlawful purpose or to solicit others to perform unlawful acts</li>
                      <li>Violating any international, federal, provincial, or state regulations, rules, laws, or local ordinances</li>
                      <li>Infringing upon or violating our intellectual property rights or the intellectual property rights of others</li>
                      <li>Harassing, abusing, insulting, harming, defaming, slandering, disparaging, intimidating, or discriminating</li>
                      <li>Submitting false or misleading information</li>
                      <li>Uploading or transmitting viruses or any other type of malicious code</li>
                      <li>Attempting to interfere with, compromise the system integrity or security</li>
                    </ul>
                  </div>
                </section>

                <Separator />

                {/* Payment Terms */}
                <section>
                  <h2 className="text-2xl font-semibold mb-4">8. Payment Terms</h2>
                  <div className="space-y-3 text-muted-foreground">
                    <p>
                      Payment terms for subscription services and transaction fees:
                    </p>
                    <ul className="list-disc pl-6 space-y-2">
                      <li>Subscription fees are billed monthly or annually as selected</li>
                      <li>Payment is due in advance of the service period</li>
                      <li>Failed payments may result in service suspension</li>
                      <li>Refunds are processed according to our refund policy</li>
                      <li>Transaction fees may apply for payment processing</li>
                    </ul>
                  </div>
                </section>

                <Separator />

                {/* Liability and Disclaimers */}
                <section>
                  <h2 className="text-2xl font-semibold mb-4">9. Limitation of Liability</h2>
                  <div className="space-y-3 text-muted-foreground">
                    <p>
                      To the fullest extent permitted by applicable law:
                    </p>
                    <ul className="list-disc pl-6 space-y-2">
                      <li>We provide the service "as is" without warranties of any kind</li>
                      <li>We are not liable for any indirect, incidental, special, or consequential damages</li>
                      <li>Our total liability shall not exceed the amount paid by you for the service</li>
                      <li>Restaurants are responsible for their own business operations and customer service</li>
                      <li>We are not responsible for disputes between restaurants and customers</li>
                    </ul>
                  </div>
                </section>

                <Separator />

                {/* Intellectual Property */}
                <section>
                  <h2 className="text-2xl font-semibold mb-4">10. Intellectual Property</h2>
                  <div className="space-y-3 text-muted-foreground">
                    <p>
                      The service and its original content, features, and functionality are and will remain the exclusive property of RBS Restaurant Management System and its licensors.
                    </p>
                    <ul className="list-disc pl-6 space-y-2">
                      <li>The service is protected by copyright, trademark, and other laws</li>
                      <li>You may not duplicate, copy, or reuse any portion without written permission</li>
                      <li>Restaurant content and data remain the property of the restaurant</li>
                      <li>We grant you a limited license to use the service as intended</li>
                    </ul>
                  </div>
                </section>

                <Separator />

                {/* Termination */}
                <section>
                  <h2 className="text-2xl font-semibold mb-4">11. Termination</h2>
                  <div className="space-y-3 text-muted-foreground">
                    <p>
                      We may terminate or suspend your account and bar access to the service immediately, without prior notice or liability, under our sole discretion, for any reason whatsoever including but not limited to a breach of the Terms.
                    </p>
                    <ul className="list-disc pl-6 space-y-2">
                      <li>You may terminate your account at any time by contacting us</li>
                      <li>Upon termination, your right to use the service will cease immediately</li>
                      <li>We will provide data export options upon reasonable request</li>
                      <li>Certain provisions of these Terms will survive termination</li>
                    </ul>
                  </div>
                </section>

                <Separator />

                {/* Changes to Terms */}
                <section>
                  <h2 className="text-2xl font-semibold mb-4">12. Changes to Terms</h2>
                  <div className="space-y-3 text-muted-foreground">
                    <p>
                      We reserve the right, at our sole discretion, to modify or replace these Terms at any time. If a revision is material, we will provide at least 30 days notice prior to any new terms taking effect.
                    </p>
                    <ul className="list-disc pl-6 space-y-2">
                      <li>Continued use of the service after changes constitutes acceptance</li>
                      <li>Material changes will be communicated via email or platform notification</li>
                      <li>You may terminate your account if you disagree with new terms</li>
                    </ul>
                  </div>
                </section>

                <Separator />

                {/* Governing Law */}
                <section>
                  <h2 className="text-2xl font-semibold mb-4">13. Governing Law</h2>
                  <div className="space-y-3 text-muted-foreground">
                    <p>
                      These Terms shall be interpreted and governed by the laws of the jurisdiction in which our company is registered, without regard to its conflict of law provisions.
                    </p>
                    <p>
                      Our failure to enforce any right or provision of these Terms will not be considered a waiver of those rights.
                    </p>
                  </div>
                </section>

                <Separator />

                {/* Contact Information */}
                <section>
                  <h2 className="text-2xl font-semibold mb-4">14. Contact Information</h2>
                  <div className="space-y-3 text-muted-foreground">
                    <p>
                      If you have any questions about these Terms and Conditions, please contact us:
                    </p>
                    <div className="bg-muted/50 p-4 rounded-lg">
                      <p><strong>Company:</strong> Qwerty App</p>
                      <p><strong>App:</strong> Plate</p>
                      <p><strong>Email:</strong> support@plate.app</p>
                      <p><strong>Legal:</strong> legal@qwertyapp.com</p>
                    </div>
                  </div>
                </section>

                <div className="text-center text-sm text-muted-foreground mt-8 pt-8 border-t">
                  <p>© 2025 Qwerty App. All rights reserved.</p>
                  <p className="mt-2">
                    By using Plate, you acknowledge that you have read and understood these Terms and Conditions.
                  </p>
                </div>
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
