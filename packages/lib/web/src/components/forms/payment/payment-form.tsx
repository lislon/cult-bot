import React, { FormEvent } from 'react'
import styles from './payment-form.module.scss'
import Link from 'next/link'
import { CreatePaymentResponse } from '@culthub/interfaces'
import { faExternalLinkAlt } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import Image from 'next/image'

interface PaymentFormProps {
    onPay: (e: FormEvent) => void
    details: CreatePaymentResponse
}

export function PaymentForm({onPay, details}: PaymentFormProps): JSX.Element {
    return (
        <div className={styles.paymentForm}>
            <div>
                <Image src="/logo.svg" alt="Logo" width={150} height={150}/>
            </div>
            <h1 className={styles.title}>
                Подписка КультХаб
            </h1>

            <p className={styles.description}>
                Счет {details.paymentId}, {details.amount} руб.
            </p>

            <form onSubmit={onPay}>
                <input type="hidden" name="terminalkey" value="TinkoffBankTest"/>
                <input type="hidden" name="frame" value="true"/>
                <input type="hidden" name="language" value="ru"/>
                <input type="hidden" name="reccurentPayment" value="false"/>
                <input type="hidden" name="customerKey" value=""/>
                <input type="hidden" placeholder="Сумма заказа" name="amount" value={details.amount}/>
                <input type="hidden" placeholder="Номер заказа" name="order" value={details.paymentId}/>
                <input type="hidden" placeholder="Описание заказа" name="description" value={details.description}/>
                <div>
                    <input type="text" placeholder="Введите email для отправки чека" name="email"/>
                </div>
                <div>
                    <input className={styles.button} type="submit" value="Оплатить"/>
                </div>
                <div>
                    Нажимая кнопку Оплатить и совершая покупку, вы принимаете условия
                    <Link href="/oferta">
                        <a target="_blank" className={styles.ofertaLink}>Публичной Оферты <FontAwesomeIcon
                            icon={faExternalLinkAlt} className={styles.myIcon}/></a>
                    </Link>

                </div>
            </form>
        </div>
    )
}