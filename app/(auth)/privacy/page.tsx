"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import Link from "next/link"
import { ArrowLeft, Shield, Eye, Database, Lock, UserCheck, AlertTriangle } from "lucide-react"

export default function PrivacyPage() {
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
              <Shield className="h-8 w-8 text-primary" />
              Privacy Policy
            </CardTitle>
            <p className="text-center text-muted-foreground">
              Effective Date: January 1, 2025<br />
              Last Updated: January 1, 2025
            </p>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[600px] w-full pr-4">
              <div className="space-y-8">
                {/* Introduction */}
                <section>
                  <h2 className="text-2xl font-semibold mb-4 flex items-center gap-2">
                    <UserCheck className="h-6 w-6 text-primary" />
                    1. Introduction
                  </h2>
                  <p className="text-muted-foreground leading-relaxed mb-4">
                    Welcome to Plate's Privacy Policy. Qwerty App ("we," "us," "our") is committed to protecting your privacy and ensuring the security of your personal information. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our mobile application Plate ("App").
                  </p>
                  <p className="text-muted-foreground leading-relaxed">
                    By using Plate, you consent to the data practices described in this policy. If you do not agree with our policies and practices, please do not use our App.
                  </p>
                </section>

                <Separator />

                {/* Information We Collect */}
                <section>
                  <h2 className="text-2xl font-semibold mb-4 flex items-center gap-2">
                    <Database className="h-6 w-6 text-primary" />
                    2. Information We Collect
                  </h2>
                  <div className="space-y-4 text-muted-foreground">
                    <div>
                      <h3 className="text-lg font-medium text-foreground mb-2">2.1 Information You Provide Directly</h3>
                      
                      <div className="space-y-3 ml-4">
                        <div>
                          <h4 className="font-medium text-foreground mb-2">Account Registration</h4>
                          <ul className="list-disc pl-6 space-y-1">
                            <li>Full name</li>
                            <li>Email address</li>
                            <li>Phone number</li>
                            <li>Password (encrypted)</li>
                            <li>Profile photo (optional)</li>
                            <li>Date of birth (optional)</li>
                          </ul>
                        </div>
                        
                        <div>
                          <h4 className="font-medium text-foreground mb-2">Profile Information</h4>
                          <ul className="list-disc pl-6 space-y-1">
                            <li>Dietary restrictions and preferences</li>
                            <li>Favorite cuisines</li>
                            <li>Allergies</li>
                            <li>Preferred party size</li>
                            <li>Special occasion dates</li>
                          </ul>
                        </div>
                        
                        <div>
                          <h4 className="font-medium text-foreground mb-2">Booking Information</h4>
                          <ul className="list-disc pl-6 space-y-1">
                            <li>Reservation details (date, time, party size)</li>
                            <li>Special requests</li>
                            <li>Dietary notes</li>
                            <li>Guest information (for group bookings)</li>
                            <li>Table preferences</li>
                          </ul>
                        </div>
                      </div>
                    </div>
                    
                    <div>
                      <h3 className="text-lg font-medium text-foreground mb-2">2.2 Information Collected Automatically</h3>
                      
                      <div className="space-y-3 ml-4">
                        <div>
                          <h4 className="font-medium text-foreground mb-2">Device Information</h4>
                          <ul className="list-disc pl-6 space-y-1">
                            <li>Device type and model</li>
                            <li>Operating system and version</li>
                            <li>App version</li>
                            <li>Device identifiers</li>
                            <li>Network information</li>
                          </ul>
                        </div>
                      </div>
                    </div>
                  </div>
                </section>

                <Separator />

                {/* How We Use Information */}
                <section>
                  <h2 className="text-2xl font-semibold mb-4">3. How We Use Your Information</h2>
                  <div className="space-y-4 text-muted-foreground">
                    <div>
                      <h3 className="text-lg font-medium text-foreground mb-2">Service Provision</h3>
                      <ul className="list-disc pl-6 space-y-2">
                        <li>Processing and managing restaurant bookings</li>
                        <li>Providing restaurant management tools and analytics</li>
                        <li>Facilitating communication between restaurants and customers</li>
                        <li>Managing user accounts and authentication</li>
                        <li>Processing payments and billing</li>
                      </ul>
                    </div>
                    <div>
                      <h3 className="text-lg font-medium text-foreground mb-2">Service Improvement</h3>
                      <ul className="list-disc pl-6 space-y-2">
                        <li>Analyzing usage patterns to enhance user experience</li>
                        <li>Developing new features and functionality</li>
                        <li>Troubleshooting technical issues</li>
                        <li>Monitoring service performance and reliability</li>
                      </ul>
                    </div>
                    <div>
                      <h3 className="text-lg font-medium text-foreground mb-2">Communication</h3>
                      <ul className="list-disc pl-6 space-y-2">
                        <li>Sending booking confirmations and reminders</li>
                        <li>Providing customer support</li>
                        <li>Sending important service updates</li>
                        <li>Marketing communications (with consent)</li>
                      </ul>
                    </div>
                    <div>
                      <h3 className="text-lg font-medium text-foreground mb-2">Legal and Compliance</h3>
                      <ul className="list-disc pl-6 space-y-2">
                        <li>Complying with legal obligations</li>
                        <li>Protecting against fraud and abuse</li>
                        <li>Enforcing our terms of service</li>
                        <li>Responding to legal requests and court orders</li>
                      </ul>
                    </div>
                  </div>
                </section>

                <Separator />

                {/* Legal Basis for Processing */}
                <section>
                  <h2 className="text-2xl font-semibold mb-4">4. Legal Basis for Processing (GDPR)</h2>
                  <div className="space-y-3 text-muted-foreground">
                    <p>We process personal data based on the following legal grounds:</p>
                    <ul className="list-disc pl-6 space-y-2">
                      <li><strong>Contract:</strong> Processing necessary for service provision and booking management</li>
                      <li><strong>Consent:</strong> Marketing communications and non-essential features</li>
                      <li><strong>Legitimate Interest:</strong> Service improvement, analytics, and fraud prevention</li>
                      <li><strong>Legal Obligation:</strong> Compliance with applicable laws and regulations</li>
                      <li><strong>Vital Interest:</strong> Protecting health and safety (e.g., allergy information)</li>
                    </ul>
                  </div>
                </section>

                <Separator />

                {/* Information Sharing */}
                <section>
                  <h2 className="text-2xl font-semibold mb-4 flex items-center gap-2">
                    <Eye className="h-6 w-6 text-primary" />
                    5. How We Share Your Information
                  </h2>
                  <div className="space-y-4 text-muted-foreground">
                    <div>
                      <h3 className="text-lg font-medium text-foreground mb-2">With Restaurants</h3>
                      <p>Customer booking information is shared with restaurants to fulfill reservations and provide personalized service.</p>
                    </div>
                    <div>
                      <h3 className="text-lg font-medium text-foreground mb-2">Service Providers</h3>
                      <ul className="list-disc pl-6 space-y-2">
                        <li>Cloud hosting and infrastructure providers</li>
                        <li>Payment processing companies</li>
                        <li>Email and communication service providers</li>
                        <li>Analytics and monitoring services</li>
                        <li>Customer support platforms</li>
                      </ul>
                    </div>
                    <div>
                      <h3 className="text-lg font-medium text-foreground mb-2">Legal Requirements</h3>
                      <p>We may disclose information when required by law, legal process, or to protect our rights and safety.</p>
                    </div>
                    <div className="bg-amber-50 dark:bg-amber-900/20 p-4 rounded-lg border border-amber-200 dark:border-amber-800">
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5" />
                        <div>
                          <h4 className="font-medium text-amber-800 dark:text-amber-200">No Sale of Personal Data</h4>
                          <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                            We do not sell, rent, or trade personal information to third parties for marketing purposes.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </section>

                <Separator />

                {/* Data Security */}
                <section>
                  <h2 className="text-2xl font-semibold mb-4 flex items-center gap-2">
                    <Lock className="h-6 w-6 text-primary" />
                    6. Data Security
                  </h2>
                  <div className="space-y-3 text-muted-foreground">
                    <p>We implement comprehensive security measures to protect your personal information:</p>
                    <ul className="list-disc pl-6 space-y-2">
                      <li>Encryption of data in transit and at rest</li>
                      <li>Regular security audits and vulnerability assessments</li>
                      <li>Access controls and employee training</li>
                      <li>Secure cloud infrastructure with industry-standard certifications</li>
                      <li>Regular backups and disaster recovery procedures</li>
                      <li>Multi-factor authentication for administrative access</li>
                    </ul>
                    <p className="mt-4">
                      While we strive to protect your personal information, no method of transmission over the internet or electronic storage is 100% secure. We cannot guarantee absolute security.
                    </p>
                  </div>
                </section>

                <Separator />

                {/* Data Retention */}
                <section>
                  <h2 className="text-2xl font-semibold mb-4">7. Data Retention</h2>
                  <div className="space-y-3 text-muted-foreground">
                    <p>We retain personal data for the following periods:</p>
                    <ul className="list-disc pl-6 space-y-2">
                      <li><strong>Active Accounts:</strong> While your account remains active</li>
                      <li><strong>Booking Records:</strong> 7 years for accounting and legal purposes</li>
                      <li><strong>Customer Data:</strong> 3 years after last interaction (unless longer retention required)</li>
                      <li><strong>Marketing Data:</strong> Until consent is withdrawn</li>
                      <li><strong>Legal Data:</strong> As required by applicable laws</li>
                    </ul>
                    <p className="mt-4">
                      Data is securely deleted or anonymized when no longer needed for legitimate business purposes.
                    </p>
                  </div>
                </section>

                <Separator />

                {/* Your Rights */}
                <section>
                  <h2 className="text-2xl font-semibold mb-4">8. Your Data Protection Rights</h2>
                  <div className="space-y-4 text-muted-foreground">
                    <p>Depending on your location, you may have the following rights:</p>
                    <div className="grid md:grid-cols-2 gap-4">
                      <div className="space-y-3">
                        <div>
                          <h4 className="font-medium text-foreground">Access</h4>
                          <p className="text-sm">Request copies of your personal data</p>
                        </div>
                        <div>
                          <h4 className="font-medium text-foreground">Rectification</h4>
                          <p className="text-sm">Request correction of inaccurate data</p>
                        </div>
                        <div>
                          <h4 className="font-medium text-foreground">Erasure</h4>
                          <p className="text-sm">Request deletion of your data</p>
                        </div>
                        <div>
                          <h4 className="font-medium text-foreground">Restrict Processing</h4>
                          <p className="text-sm">Limit how we use your data</p>
                        </div>
                      </div>
                      <div className="space-y-3">
                        <div>
                          <h4 className="font-medium text-foreground">Data Portability</h4>
                          <p className="text-sm">Receive your data in a portable format</p>
                        </div>
                        <div>
                          <h4 className="font-medium text-foreground">Object</h4>
                          <p className="text-sm">Object to processing based on legitimate interests</p>
                        </div>
                        <div>
                          <h4 className="font-medium text-foreground">Withdraw Consent</h4>
                          <p className="text-sm">Withdraw consent for processing</p>
                        </div>
                        <div>
                          <h4 className="font-medium text-foreground">Lodge Complaints</h4>
                          <p className="text-sm">File complaints with supervisory authorities</p>
                        </div>
                      </div>
                    </div>
                    <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800 mt-4">
                      <h4 className="font-medium text-blue-800 dark:text-blue-200 mb-2">Exercising Your Rights</h4>
                      <p className="text-sm text-blue-700 dark:text-blue-300">
                        To exercise these rights, contact us at privacy@rbsrestaurant.com. We will respond within 30 days and may request verification of your identity.
                      </p>
                    </div>
                  </div>
                </section>

                <Separator />

                {/* International Transfers */}
                <section>
                  <h2 className="text-2xl font-semibold mb-4">9. International Data Transfers</h2>
                  <div className="space-y-3 text-muted-foreground">
                    <p>
                      Your personal data may be transferred to and processed in countries other than your country of residence. We ensure adequate protection through:
                    </p>
                    <ul className="list-disc pl-6 space-y-2">
                      <li>Adequacy decisions by the European Commission</li>
                      <li>Standard Contractual Clauses (SCCs)</li>
                      <li>Binding Corporate Rules</li>
                      <li>Certification schemes and codes of conduct</li>
                    </ul>
                  </div>
                </section>

                <Separator />

                {/* Children's Privacy */}
                <section>
                  <h2 className="text-2xl font-semibold mb-4">10. Children's Privacy</h2>
                  <div className="space-y-3 text-muted-foreground">
                    <p>
                      Our service is not intended for children under 13 years of age. We do not knowingly collect personal information from children under 13. If you are a parent or guardian and believe your child has provided us with personal information, please contact us to have it removed.
                    </p>
                  </div>
                </section>

                <Separator />

                {/* Cookies Policy */}
                <section>
                  <h2 className="text-2xl font-semibold mb-4">11. Cookies and Tracking Technologies</h2>
                  <div className="space-y-4 text-muted-foreground">
                    <div>
                      <h3 className="text-lg font-medium text-foreground mb-2">Types of Cookies</h3>
                      <ul className="list-disc pl-6 space-y-2">
                        <li><strong>Essential:</strong> Required for platform functionality</li>
                        <li><strong>Analytics:</strong> Help us understand usage patterns</li>
                        <li><strong>Functional:</strong> Remember your preferences</li>
                        <li><strong>Marketing:</strong> Used for targeted advertising (with consent)</li>
                      </ul>
                    </div>
                    <div>
                      <h3 className="text-lg font-medium text-foreground mb-2">Managing Cookies</h3>
                      <p>You can control cookies through your browser settings. Disabling essential cookies may affect platform functionality.</p>
                    </div>
                  </div>
                </section>

                <Separator />

                {/* Changes to Privacy Policy */}
                <section>
                  <h2 className="text-2xl font-semibold mb-4">12. Changes to This Privacy Policy</h2>
                  <div className="space-y-3 text-muted-foreground">
                    <p>
                      We may update this Privacy Policy from time to time. We will notify you of any material changes by:
                    </p>
                    <ul className="list-disc pl-6 space-y-2">
                      <li>Email notification to registered users</li>
                      <li>Prominent notice on our platform</li>
                      <li>In-app notifications</li>
                    </ul>
                    <p>
                      Changes become effective 30 days after notification. Continued use of the service constitutes acceptance of the updated policy.
                    </p>
                  </div>
                </section>

                <Separator />

                {/* Contact Information */}
                <section>
                  <h2 className="text-2xl font-semibold mb-4">13. Contact Us</h2>
                  <div className="space-y-4 text-muted-foreground">
                    <p>
                      For questions about this Privacy Policy or our data practices, contact us:
                    </p>
                    <div className="bg-muted/50 p-4 rounded-lg">
                      <div className="grid md:grid-cols-2 gap-4">
                        <div>
                          <h4 className="font-medium text-foreground mb-2">General Inquiries</h4>
                          <p><strong>Company:</strong> Qwerty App</p>
                          <p><strong>App:</strong> Plate</p>
                          <p><strong>Email:</strong> privacy@plate.app</p>
                        </div>
                        <div>
                          <h4 className="font-medium text-foreground mb-2">Data Protection</h4>
                          <p><strong>Email:</strong> dpo@qwertyapp.com</p>
                          <p><strong>Response Time:</strong> 5 business days</p>
                        </div>
                      </div>
                      <div className="mt-4">
                        <h4 className="font-medium text-foreground mb-2">Legal Contact</h4>
                        <p><strong>Email:</strong> legal@qwertyapp.com</p>
                        <p><strong>Support:</strong> support@plate.app</p>
                      </div>
                    </div>
                  </div>
                </section>

                <div className="text-center text-sm text-muted-foreground mt-8 pt-8 border-t">
                  <p>© 2025 Qwerty App. All rights reserved.</p>
                  <p className="mt-2">
                    This Privacy Policy is designed to comply with GDPR, CCPA, and other applicable privacy laws.
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
