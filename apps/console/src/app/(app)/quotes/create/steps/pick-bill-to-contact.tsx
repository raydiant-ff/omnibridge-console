"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ArrowLeft, ArrowRight, Plus, User, Mail, Phone, Briefcase, Check } from "lucide-react";
import { getAccountContacts } from "@/lib/queries/contacts";
import { createContact, setBillToContact } from "@/lib/actions/contacts";
import type { AccountContact } from "@/lib/queries/contacts";

interface Props {
  sfAccountId: string;
  billToContactId: string;
  onChange: (contactId: string) => void;
  onNext: () => void;
  onBack: () => void;
}

export function PickBillToContact({ sfAccountId, billToContactId, onChange, onNext, onBack }: Props) {
  const [contacts, setContacts] = useState<AccountContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedContactId, setSelectedContactId] = useState(billToContactId);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [creating, setCreating] = useState(false);
  const [setting, setSetting] = useState(false);

  // New contact form
  const [newContact, setNewContact] = useState({
    firstName: "",
    lastName: "",
    email: "",
    title: "",
    phone: "",
  });

  useEffect(() => {
    if (!sfAccountId) return;
    
    loadContacts();
  }, [sfAccountId]);

  async function loadContacts() {
    setLoading(true);
    setError(null);
    
    try {
      const result = await getAccountContacts(sfAccountId);
      setContacts(result);
      
      // If there's already a Bill-To contact, select it
      const currentBillTo = result.find(c => c.isBillTo);
      if (currentBillTo && !selectedContactId) {
        setSelectedContactId(currentBillTo.id);
        onChange(currentBillTo.id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load contacts");
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateContact() {
    if (!newContact.firstName.trim() || !newContact.lastName.trim() || !newContact.email.trim()) {
      return;
    }

    setCreating(true);
    
    try {
      const result = await createContact({
        sfAccountId,
        firstName: newContact.firstName,
        lastName: newContact.lastName,
        email: newContact.email,
        title: newContact.title || undefined,
        phone: newContact.phone || undefined,
      });

      if (result.success && result.contactId) {
        // Add to local list
        const newContactData: AccountContact = {
          id: result.contactId,
          firstName: newContact.firstName,
          lastName: newContact.lastName,
          email: newContact.email,
          title: newContact.title || undefined,
          phone: newContact.phone || undefined,
          isBillTo: false,
        };
        
        setContacts(prev => [...prev, newContactData]);
        setSelectedContactId(result.contactId);
        onChange(result.contactId);
        
        // Reset form and close dialog
        setNewContact({ firstName: "", lastName: "", email: "", title: "", phone: "" });
        setShowCreateDialog(false);
      } else {
        setError(result.error || "Failed to create contact");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create contact");
    } finally {
      setCreating(false);
    }
  }

  async function handleNext() {
    if (!selectedContactId) return;

    setSetting(true);
    
    try {
      const result = await setBillToContact(sfAccountId, selectedContactId);
      if (result.success) {
        onNext();
      } else {
        setError(result.error || "Failed to set Bill-To Contact");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to set Bill-To Contact");
    } finally {
      setSetting(false);
    }
  }

  function handleSelectContact(contactId: string) {
    setSelectedContactId(contactId);
    onChange(contactId);
    setError(null);
  }

  const isFormValid = newContact.firstName.trim() && newContact.lastName.trim() && newContact.email.trim();

  if (!sfAccountId) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-center text-muted-foreground">Please select a customer first.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <User className="size-5" />
          Select Bill-To Contact
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Choose the contact who will receive invoices and billing communications.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <div className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3">
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}

        {loading ? (
          <div className="text-center py-8">
            <p className="text-muted-foreground">Loading contacts...</p>
          </div>
        ) : contacts.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-muted-foreground mb-4">No contacts found for this account.</p>
            <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="size-4 mr-2" />
                  Create New Contact
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create New Contact</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="firstName">First Name *</Label>
                      <Input
                        id="firstName"
                        value={newContact.firstName}
                        onChange={(e) => setNewContact(prev => ({ ...prev, firstName: e.target.value }))}
                        placeholder="John"
                      />
                    </div>
                    <div>
                      <Label htmlFor="lastName">Last Name *</Label>
                      <Input
                        id="lastName"
                        value={newContact.lastName}
                        onChange={(e) => setNewContact(prev => ({ ...prev, lastName: e.target.value }))}
                        placeholder="Smith"
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="email">Email *</Label>
                    <Input
                      id="email"
                      type="email"
                      value={newContact.email}
                      onChange={(e) => setNewContact(prev => ({ ...prev, email: e.target.value }))}
                      placeholder="john.smith@company.com"
                    />
                  </div>
                  <div>
                    <Label htmlFor="title">Title</Label>
                    <Input
                      id="title"
                      value={newContact.title}
                      onChange={(e) => setNewContact(prev => ({ ...prev, title: e.target.value }))}
                      placeholder="Finance Manager"
                    />
                  </div>
                  <div>
                    <Label htmlFor="phone">Phone</Label>
                    <Input
                      id="phone"
                      value={newContact.phone}
                      onChange={(e) => setNewContact(prev => ({ ...prev, phone: e.target.value }))}
                      placeholder="(555) 123-4567"
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                      Cancel
                    </Button>
                    <Button onClick={handleCreateContact} disabled={!isFormValid || creating}>
                      {creating ? "Creating..." : "Create Contact"}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <h3 className="font-medium">Available Contacts</h3>
              <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Plus className="size-4 mr-2" />
                    Add New
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Create New Contact</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="firstName">First Name *</Label>
                        <Input
                          id="firstName"
                          value={newContact.firstName}
                          onChange={(e) => setNewContact(prev => ({ ...prev, firstName: e.target.value }))}
                          placeholder="John"
                        />
                      </div>
                      <div>
                        <Label htmlFor="lastName">Last Name *</Label>
                        <Input
                          id="lastName"
                          value={newContact.lastName}
                          onChange={(e) => setNewContact(prev => ({ ...prev, lastName: e.target.value }))}
                          placeholder="Smith"
                        />
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="email">Email *</Label>
                      <Input
                        id="email"
                        type="email"
                        value={newContact.email}
                        onChange={(e) => setNewContact(prev => ({ ...prev, email: e.target.value }))}
                        placeholder="john.smith@company.com"
                      />
                    </div>
                    <div>
                      <Label htmlFor="title">Title</Label>
                      <Input
                        id="title"
                        value={newContact.title}
                        onChange={(e) => setNewContact(prev => ({ ...prev, title: e.target.value }))}
                        placeholder="Finance Manager"
                      />
                    </div>
                    <div>
                      <Label htmlFor="phone">Phone</Label>
                      <Input
                        id="phone"
                        value={newContact.phone}
                        onChange={(e) => setNewContact(prev => ({ ...prev, phone: e.target.value }))}
                        placeholder="(555) 123-4567"
                      />
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                        Cancel
                      </Button>
                      <Button onClick={handleCreateContact} disabled={!isFormValid || creating}>
                        {creating ? "Creating..." : "Create Contact"}
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            <div className="grid gap-3">
              {contacts.map((contact) => (
                <div
                  key={contact.id}
                  className={`border rounded-xl p-4 cursor-pointer transition-colors ${
                    selectedContactId === contact.id
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50"
                  }`}
                  onClick={() => handleSelectContact(contact.id)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-medium">
                          {contact.firstName} {contact.lastName}
                        </h4>
                        {contact.isBillTo && (
                          <Badge variant="secondary" className="text-xs">
                            Current Bill-To
                          </Badge>
                        )}
                        {selectedContactId === contact.id && (
                          <Check className="size-4 text-primary" />
                        )}
                      </div>
                      <div className="space-y-1 text-sm text-muted-foreground">
                        <div className="flex items-center gap-2">
                          <Mail className="size-3" />
                          {contact.email}
                        </div>
                        {contact.title && (
                          <div className="flex items-center gap-2">
                            <Briefcase className="size-3" />
                            {contact.title}
                          </div>
                        )}
                        {contact.phone && (
                          <div className="flex items-center gap-2">
                            <Phone className="size-3" />
                            {contact.phone}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex justify-between pt-4">
          <Button variant="outline" onClick={onBack}>
            <ArrowLeft className="size-4 mr-2" />
            Back
          </Button>
          <Button 
            onClick={handleNext} 
            disabled={!selectedContactId || setting}
          >
            {setting ? "Setting..." : "Continue"}
            <ArrowRight className="size-4 ml-2" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}