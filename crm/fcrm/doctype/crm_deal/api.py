import frappe


@frappe.whitelist()
def get_deal_contacts(name: str):
	contacts = frappe.get_all(
		"CRM Contacts",
		filters={"parenttype": "CRM Deal", "parent": name},
		fields=["contact", "is_primary"],
		distinct=True,
	)
	deal_contacts = []
	for contact in contacts:
		if not contact.contact:
			continue

		is_primary = contact.is_primary
		contact = frappe.get_doc("Contact", contact.contact).as_dict()

		# F3/P-D10: мультиконтакты — отдаём ВСЕ телефоны/e-mail (нативные child-таблицы
		# Contact.phone_nos / Contact.email_ids) + кастом-поля мессенджеров
		# (nacifrah_telegram / nacifrah_max), чтобы карточка сделки рисовала
		# кликабельные поля по образцу карточки сотрудника. Своих таблиц не плодим.
		phone_nos = [
			p.get("phone")
			for p in (contact.get("phone_nos") or [])
			if p.get("phone")
		]
		email_ids = [
			e.get("email_id")
			for e in (contact.get("email_ids") or [])
			if e.get("email_id")
		]

		_contact = {
			"name": contact.name,
			"image": contact.image,
			"full_name": contact.full_name,
			"email": contact.email_id,
			"mobile_no": contact.mobile_no,
			"is_primary": is_primary,
			"phone_nos": phone_nos,
			"email_ids": email_ids,
			"nacifrah_telegram": contact.get("nacifrah_telegram"),
			"nacifrah_max": contact.get("nacifrah_max"),
		}
		deal_contacts.append(_contact)
	return deal_contacts
