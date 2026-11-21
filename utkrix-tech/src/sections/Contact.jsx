import { company } from "../config/site.js";
import Icon from "../components/Icon.jsx";
import SectionHeading from "../components/SectionHeading.jsx";
import ContactForm from "../components/ContactForm.jsx";

const mapUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(company.address)}`;

export default function Contact() {
  return (
    <section id="contact" className="section section--tint" aria-labelledby="contact-title">
      <div className="container">
        <SectionHeading id="contact-title" title="Contact us" intro="Tell us about your project and we will get back to you." />
        <div className="contact__grid">
          <ul className="contact__list">
            <li>
              <Icon name="pin" />
              <div>
                <h3>Address</h3>
                <a href={mapUrl} target="_blank" rel="noopener noreferrer">{company.address}<span className="sr-only"> (opens in a new tab)</span></a>
              </div>
            </li>
            <li>
              <Icon name="mail" />
              <div>
                <h3>Email</h3>
                <a href={`mailto:${company.email}`}>{company.email}</a>
              </div>
            </li>
            <li>
              <Icon name="call" />
              <div>
                <h3>Phone</h3>
                <a href={`tel:${company.phone}`}>{company.phone}</a>
              </div>
            </li>
          </ul>
          <ContactForm />
        </div>
      </div>
    </section>
  );
}
