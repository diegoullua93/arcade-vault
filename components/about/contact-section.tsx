import { ContactForm } from "@/components/about/contact-form";
import { Reveal } from "@/components/home/reveal";
import { CONTACT_TIPS } from "@/lib/contact";

export function ContactSection() {
  return (
    <Reveal className="about-contact">
      <div className="contact-grid">
        <div className="contact-intro">
          <div className="kicker pixel neon-cyan">▸ CONTACTO</div>
          <h2 className="contact-title">CONTÁCTANOS</h2>
          <p className="contact-sub">
            ¿Tienes alguna sugerencia, quieres proponer un juego, o simplemente quieres saludar?
            Escríbenos.
          </p>
          <div className="contact-tips">
            {CONTACT_TIPS.map((t) => (
              <div key={t.text} className="tip">
                <span className={"tip-led" + (t.led ? " " + t.led : "")}></span>
                {t.text}
              </div>
            ))}
          </div>
        </div>

        <ContactForm />
      </div>
    </Reveal>
  );
}
